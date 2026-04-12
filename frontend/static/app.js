class WebRTCConnection {
    constructor() {
        this.pc = null;
        this.dc = null;
        this.ws = null;
        this.role = null;
        this.code = null;
        this.status = 'disconnected';

        this.pendingCandidates = [];
        this.heartbeatInterval = null;
        this.reconnectAttempts = 0;
        this.isIntentionalClose = false;
        this.isFatalError = false;
        this.isCreatingOffer = false;
        this.offerRetryTimeout = null;
        this.offerRetryAttempts = 0;

        this.speedStats = {
            lastTime: 0,
            lastBytes: 0,
            currentSpeed: 0,
            speedHistory: [],
            lastSpeedUpdate: 0
        };

        this.currentIncomingTransfer = null;
        this.sendQueue = [];
        this.transferNodes = new Map();

        // 连接质量监控
        this.statsInterval = null;
        this.lastStats = null;
        this.connectionQuality = 'unknown'; // 'good', 'fair', 'poor'

        this.onStatusChange = null;
        this.onChatMessage = null;
        this.onTransferEvent = null;
        this.onError = null;
    }

    async createRoom() {
        const response = await fetch('/api/create-room', { method: 'POST' });
        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to create room');
        }

        this.code = data.code;
        await this.connect('sender');
        return data.code;
    }

    async joinRoom(code) {
        this.code = code;
        await this.connect('receiver');
    }

    async attachToRoom(code, role) {
        this.code = code;
        await this.connect(role);
    }

    async connect(role) {
        this.role = role;
        this.updateStatus('connecting');
        this.ws = new WebSocket(this.getWsUrl(role));

        return new Promise((resolve, reject) => {
            this.ws.onopen = () => {
                this.reconnectAttempts = 0;
                if (!this.pc) {
                    this.setupPeerConnection();
                }
                this.startHeartbeat();
                if (this.role === 'sender') {
                    this.maybeCreateOfferForWaitingPeer().catch((error) => {
                        console.warn('Deferred offer creation failed:', error);
                    });
                }
                resolve();
            };

            this.ws.onerror = (error) => {
                reject(error);
            };

            this.ws.onmessage = (event) => {
                this.handleSignalMessage(JSON.parse(event.data));
            };

            this.ws.onclose = () => {
                this.stopHeartbeat();
                if (this.isIntentionalClose || this.isFatalError) {
                    this.updateStatus('disconnected');
                    return;
                }

                this.updateStatus('connecting');
                this.reconnectAttempts += 1;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
                setTimeout(() => this.reconnectWS(), delay);
            };
        });
    }

    getWsUrl(role) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/api/ws?code=${this.code}&role=${role}`;
    }

    reconnectWS() {
        if (this.isIntentionalClose || this.isFatalError) {
            return;
        }

        this.ws = new WebSocket(this.getWsUrl(this.role));
        this.updateStatus('connecting');

        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
            this.startHeartbeat();

            if (!this.isTransportReady() && this.role === 'sender') {
                this.resetPeerConnection();
                this.setupPeerConnection();
            }

            if (this.role === 'sender') {
                this.maybeCreateOfferForWaitingPeer().catch((error) => {
                    console.warn('Deferred reconnect offer failed:', error);
                });
            }
        };

        this.ws.onmessage = (event) => {
            this.handleSignalMessage(JSON.parse(event.data));
        };

        this.ws.onclose = () => {
            this.stopHeartbeat();
            if (this.isIntentionalClose || this.isFatalError) {
                return;
            }
            this.reconnectAttempts += 1;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
            setTimeout(() => this.reconnectWS(), delay);
        };

        this.ws.onerror = () => {};
    }

    setupPeerConnection() {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                { urls: 'stun:stun.qq.com:3478' },
            ],
        };

        this.pc = new RTCPeerConnection(config);

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'ice-candidate',
                    candidate: JSON.stringify(event.candidate),
                });
            }
        };

        this.pc.onconnectionstatechange = () => {
            if (!this.pc) {
                return;
            }

            const state = this.pc.connectionState;
            if (state === 'connected') {
                this.updateStatus('connected');
            } else if (state === 'connecting') {
                this.updateStatus('connecting');
            } else if (state === 'disconnected') {
                this.updateStatus('reconnecting');
                setTimeout(() => {
                    if (this.pc && this.pc.connectionState === 'disconnected') {
                        this.restartIce();
                    }
                }, 3000);
            } else if (state === 'failed') {
                this.updateStatus('failed');
            } else if (state === 'closed') {
                this.updateStatus('disconnected');
            }
        };

        this.pc.onicecandidateerror = (event) => {
            if (event.errorCode !== 701) {
                console.error('ICE Candidate Error:', event);
            }
        };

        if (this.role === 'sender') {
            this.dc = this.pc.createDataChannel('session');
            this.setupDataChannel();
        } else {
            this.pc.ondatachannel = (event) => {
                this.dc = event.channel;
                this.setupDataChannel();
            };
        }
    }

    setupDataChannel() {
        this.dc.onopen = () => {
            this.updateStatus('connected');
        };

        this.dc.onclose = () => {
            if (!this.isIntentionalClose) {
                this.updateStatus('disconnected');
            }
        };

        this.dc.onmessage = async (event) => {
            try {
                if (typeof event.data === 'string') {
                    await this.handleDataMessage(JSON.parse(event.data));
                } else {
                    await this.handleFileChunk(event.data);
                }
            } catch (error) {
                console.error('DataChannel message error:', error);
            }
        };
    }

    async createOffer() {
        const pc = this.pc;
        if (!pc || pc.connectionState === 'closed' || pc.signalingState !== 'stable' || this.isCreatingOffer) {
            return;
        }

        this.isCreatingOffer = true;
        try {
            const offer = await pc.createOffer();
            if (
                this.pc !== pc ||
                pc.connectionState === 'closed' ||
                pc.signalingState === 'closed' ||
                pc.signalingState !== 'stable' ||
                !this.ws ||
                this.ws.readyState !== WebSocket.OPEN
            ) {
                return;
            }

            await pc.setLocalDescription(offer);
            if (this.pc !== pc || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return;
            }

            this.sendSignal({ type: 'offer', sdp: offer.sdp });
        } finally {
            if (this.pc === pc) {
                this.isCreatingOffer = false;
            }
        }
    }

    canCreateOfferNow() {
        return Boolean(
            this.pc &&
            this.pc.connectionState !== 'closed' &&
            this.pc.signalingState === 'stable' &&
            !this.isCreatingOffer
        );
    }

    scheduleOfferRetry(delay = 1000) {
        if (this.offerRetryTimeout || this.role !== 'sender' || this.isIntentionalClose || this.isFatalError) {
            return;
        }

        if (this.offerRetryAttempts >= 5) {
            return;
        }

        this.offerRetryAttempts += 1;
        const nextDelay = Math.min(delay * Math.pow(2, this.offerRetryAttempts - 1), 10000);

        this.offerRetryTimeout = setTimeout(() => {
            this.offerRetryTimeout = null;
            this.maybeCreateOfferForWaitingPeer().catch((error) => {
                console.warn('Scheduled offer retry failed:', error);
            });
        }, nextDelay);
    }

    async maybeCreateOfferForWaitingPeer() {
        if (this.role !== 'sender' || !this.code || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            const response = await fetch(`/api/room-info?code=${encodeURIComponent(this.code)}`);
            if (!response.ok) {
                throw new Error(`Room info request failed with ${response.status}`);
            }
            const data = await response.json();
            if (data.success && data.status && data.status.has_receiver) {
                if (!this.canCreateOfferNow()) {
                    this.scheduleOfferRetry(500);
                    return;
                }
                this.offerRetryAttempts = 0;
                await this.createOffer();
            }
        } catch (error) {
            console.warn('Failed to query room status:', error);
            this.scheduleOfferRetry(1500);
        }
    }

    async handleSignalMessage(message) {
        switch (message.type) {
            case 'peer-joined':
                if (this.role === 'sender' && message.role === 'receiver') {
                    this.resetPeerConnection();
                    this.setupPeerConnection();
                    await this.createOffer();
                }
                break;

            case 'offer':
                if (!this.pc) {
                    this.setupPeerConnection();
                }
                await this.pc.setRemoteDescription({ type: 'offer', sdp: message.sdp });
                await this.flushCandidates();
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                this.sendSignal({ type: 'answer', sdp: answer.sdp });
                break;

            case 'answer':
                await this.pc.setRemoteDescription({ type: 'answer', sdp: message.sdp });
                await this.flushCandidates();
                break;

            case 'ice-candidate': {
                const candidate = JSON.parse(message.candidate);
                if (this.pc.remoteDescription) {
                    await this.pc.addIceCandidate(candidate);
                } else {
                    this.pendingCandidates.push(candidate);
                }
                break;
            }

            case 'peer-left':
                this.updateStatus('peer-left');
                break;

            case 'error':
                // 服务端明确拒绝（房间不存在等），停止自动重连
                this.isFatalError = true;
                this.updateStatus('failed');
                if (this.onError) {
                    this.onError(message.message);
                }
                break;
        }
    }

    async flushCandidates() {
        for (const candidate of this.pendingCandidates) {
            await this.pc.addIceCandidate(candidate);
        }
        this.pendingCandidates = [];
    }

    sendSignal(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    updateStatus(status) {
        this.status = status;
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
    }

    resetPeerConnection() {
        // 清理 DataChannel 及其回调
        if (this.dc) {
            try {
                // 移除所有事件监听器
                this.dc.onopen = null;
                this.dc.onclose = null;
                this.dc.onerror = null;
                this.dc.onmessage = null;
                this.dc.close();
            } catch (error) {
                console.warn('DataChannel close warning:', error);
            }
        }

        // 清理 PeerConnection 及其回调
        if (this.pc) {
            try {
                this.pc.onicecandidate = null;
                this.pc.ondatachannel = null;
                this.pc.onconnectionstatechange = null;
                this.pc.oniceconnectionstatechange = null;
                this.pc.close();
            } catch (error) {
                console.warn('PeerConnection close warning:', error);
            }
        }

        // 清理传输相关状态
        this.dc = null;
        this.pc = null;
        this.isCreatingOffer = false;
        this.pendingCandidates = [];
        this.offerRetryAttempts = 0;
        if (this.offerRetryTimeout) {
            clearTimeout(this.offerRetryTimeout);
            this.offerRetryTimeout = null;
        }

        // 清理未完成的传输
        this.cleanupPendingTransfers();

        // 停止统计监控
        this.stopStatsMonitoring();
    }

    cleanupPendingTransfers() {
        // 清理当前接收中的传输
        if (this.currentIncomingTransfer) {
            try {
                if (this.currentIncomingTransfer.fileWriter) {
                    this.currentIncomingTransfer.fileWriter.abort();
                }
            } catch (error) {
                console.warn('FileWriter abort warning:', error);
            }
            this.currentIncomingTransfer = null;
        }

        // 清理发送队列
        this.sendQueue = [];

        // 清理传输节点
        this.transferNodes.clear();
    }

    startStatsMonitoring() {
        this.stopStatsMonitoring();
        this.statsInterval = setInterval(() => this.updateConnectionStats(), 5000);
    }

    stopStatsMonitoring() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }

    async updateConnectionStats() {
        if (!this.pc || this.pc.connectionState !== 'connected') {
            return;
        }

        try {
            const stats = await this.pc.getStats();
            let totalRtt = 0;
            let rttCount = 0;
            let packetLoss = 0;
            let availableBitrate = 0;

            stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime) {
                        totalRtt += report.currentRoundTripTime;
                        rttCount++;
                    }
                }

                if (report.type === 'inbound-rtp' || report.type === 'outbound-rtp') {
                    // 使用 packetsReceived/sent 和 packetsLost 计算丢包率
                    if (report.packetsLost !== undefined) {
                        const totalPackets = (report.packetsReceived || report.packetsSent || 0) + report.packetsLost;
                        if (totalPackets > 0) {
                            packetLoss = Math.max(packetLoss, report.packetsLost / totalPackets);
                        }
                    }
                }

                if (report.type === 'transport') {
                    if (report.availableOutgoingBitrate) {
                        availableBitrate = report.availableOutgoingBitrate;
                    }
                }
            });

            const avgRtt = rttCount > 0 ? totalRtt / rttCount : 0;

            // 评估连接质量
            let quality = 'good';
            if (avgRtt > 1000 || packetLoss > 0.1) {
                quality = 'poor';
            } else if (avgRtt > 500 || packetLoss > 0.05) {
                quality = 'fair';
            }

            if (quality !== this.connectionQuality) {
                this.connectionQuality = quality;
                this.notifyQualityChange(quality, { rtt: avgRtt, loss: packetLoss * 100 });
            }

        } catch (error) {
            console.warn('Failed to get connection stats:', error);
        }
    }

    notifyQualityChange(quality, metrics) {
        if (this.onStatusChange) {
            this.onStatusChange(`quality-${quality}`, metrics);
        }
    }

    updateSpeedStats(instantSpeed, remainingBytes) {
        // 维护速度历史记录（最近10个样本）
        this.speedStats.speedHistory.push(instantSpeed);
        if (this.speedStats.speedHistory.length > 10) {
            this.speedStats.speedHistory.shift();
        }

        // 计算平滑速度（移动平均）
        const avgSpeed = this.speedStats.speedHistory.reduce((sum, s) => sum + s, 0) / this.speedStats.speedHistory.length;
        this.speedStats.currentSpeed = avgSpeed;

        return avgSpeed;
    }

    calculateETA(remainingBytes, speedBytesPerSecond) {
        if (speedBytesPerSecond <= 0) {
            return null;
        }

        const seconds = remainingBytes / speedBytesPerSecond;

        if (seconds < 60) {
            return Math.round(seconds) + 's';
        } else if (seconds < 3600) {
            return Math.round(seconds / 60) + 'm';
        } else {
            return Math.round(seconds / 3600) + 'h';
        }
    }

    formatSpeed(bytesPerSecond) {
        if (bytesPerSecond < 1024) {
            return Math.round(bytesPerSecond) + ' B/s';
        } else if (bytesPerSecond < 1024 * 1024) {
            return (bytesPerSecond / 1024).toFixed(1) + ' KB/s';
        } else {
            return (bytesPerSecond / (1024 * 1024)).toFixed(1) + ' MB/s';
        }
    }

    async restartIce() {
        if (!this.pc || this.pc.connectionState === 'closed') {
            return;
        }

        // 只有 offerer (sender) 才主动发起 ICE restart
        if (this.role !== 'sender') {
            return;
        }

        try {
            const offer = await this.pc.createOffer({ iceRestart: true });
            await this.pc.setLocalDescription(offer);
            this.sendSignal({ type: 'offer', sdp: offer.sdp });
        } catch (error) {
            console.warn('ICE restart failed:', error);
        }
    }

    isTransportReady() {
        return Boolean(this.dc && this.dc.readyState === 'open');
    }

    assertTransportReady() {
        if (!this.isTransportReady()) {
            throw new Error('Transport not ready');
        }
    }

    sendChatMessage(text) {
        const message = text.trim();
        if (!message) {
            return;
        }

        this.assertTransportReady();
        this.dc.send(JSON.stringify({
            type: 'chat',
            text: message,
            ts: Date.now(),
        }));
    }

    async sendFile(file, { id, onProgress } = {}) {
        this.assertTransportReady();

        const transferId = id || `file-${Date.now()}`;
        const send = (data) => this.dc.send(data);

        send(JSON.stringify({
            type: 'file-meta',
            id: transferId,
            name: file.name,
            size: file.size,
            mimeType: file.type,
        }));

        const chunkSize = 256 * 1024;
        const totalChunks = Math.ceil(file.size / chunkSize);
        let sentBytes = 0;

        const bufferHigh = 4 * 1024 * 1024;
        const bufferLow = 1 * 1024 * 1024;
        this.dc.bufferedAmountLowThreshold = bufferLow;
        this.speedStats.lastTime = 0;
        this.speedStats.lastBytes = 0;
        this.speedStats.currentSpeed = 0;

        for (let index = 0; index < totalChunks; index += 1) {
            const start = index * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const arrayBuffer = await file.slice(start, end).arrayBuffer();

            send(JSON.stringify({ type: 'chunk-info', id: transferId, index, total: totalChunks }));

            if (this.dc.bufferedAmount > bufferHigh) {
                await new Promise((resolve) => {
                    this.dc.onbufferedamountlow = () => {
                        this.dc.onbufferedamountlow = null;
                        resolve();
                    };
                });
            }

            send(arrayBuffer);
            sentBytes += arrayBuffer.byteLength;
            const speed = this.calculateSpeed(sentBytes, file.size);

            if (onProgress) {
                onProgress({
                    id: transferId,
                    progress: Math.round((sentBytes / file.size) * 100),
                    speed,
                    sentBytes,
                    totalBytes: file.size,
                });
            }
        }

        await new Promise((resolve) => {
            const waitForDrain = () => {
                if (!this.dc || this.dc.bufferedAmount === 0) {
                    resolve();
                } else {
                    setTimeout(waitForDrain, 100);
                }
            };
            waitForDrain();
        });

        send(JSON.stringify({ type: 'complete', id: transferId }));
        return transferId;
    }

    async handleDataMessage(message) {
        switch (message.type) {
            case 'chat':
                if (this.onChatMessage) {
                    this.onChatMessage(message);
                }
                break;

            case 'file-meta':
                await this.prepareIncomingTransfer(message);
                break;

            case 'chunk-info':
                if (this.currentIncomingTransfer && this.currentIncomingTransfer.id === message.id) {
                    this.currentIncomingTransfer.totalChunks = message.total;
                    this.currentIncomingTransfer.chunkIndex = message.index;
                }
                break;

            case 'complete':
                await this.completeIncomingTransfer(message.id);
                break;

            case 'cancel':
                await this.cancelIncomingTransfer(message.id);
                break;
        }
    }

    async prepareIncomingTransfer(message) {
        const transfer = {
            id: message.id,
            metadata: message,
            receiveBuffer: [],
            receivedSize: 0,
            fileWriter: null,
            useStreaming: false,
        };

        if (message.size > 100 * 1024 * 1024) {
            await this.initStreamingDownload(transfer);
        }

        this.currentIncomingTransfer = transfer;
        this.speedStats.lastTime = 0;
        this.speedStats.lastBytes = 0;
        this.speedStats.currentSpeed = 0;

        this.emitTransferEvent({
            type: 'receive-start',
            id: transfer.id,
            name: message.name,
            size: message.size,
        });
    }

    async initStreamingDownload(transfer) {
        try {
            if (!window.showSaveFilePicker) {
                return;
            }

            const metadata = transfer.metadata;
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: metadata.name,
                types: [{
                    description: 'File',
                    accept: { [metadata.mimeType || 'application/octet-stream']: [] },
                }],
            });

            transfer.fileWriter = await fileHandle.createWritable();
            transfer.useStreaming = true;
        } catch (error) {
            transfer.useStreaming = false;
        }
    }

    async handleFileChunk(arrayBuffer) {
        const transfer = this.currentIncomingTransfer;
        if (!transfer) {
            return;
        }

        if (transfer.useStreaming && transfer.fileWriter) {
            try {
                await transfer.fileWriter.write(arrayBuffer);
            } catch (error) {
                transfer.useStreaming = false;
                transfer.receiveBuffer.push(arrayBuffer);
            }
        } else {
            transfer.receiveBuffer.push(arrayBuffer);
        }

        transfer.receivedSize += arrayBuffer.byteLength;
        const speed = this.calculateSpeed(transfer.receivedSize, transfer.metadata.size);

        this.emitTransferEvent({
            type: 'receive-progress',
            id: transfer.id,
            progress: Math.round((transfer.receivedSize / transfer.metadata.size) * 100),
            speed,
            receivedBytes: transfer.receivedSize,
            totalBytes: transfer.metadata.size,
        });
    }

    async completeIncomingTransfer(id) {
        const transfer = this.currentIncomingTransfer;
        if (!transfer || (id && transfer.id !== id)) {
            return;
        }

        if (transfer.useStreaming && transfer.fileWriter) {
            await transfer.fileWriter.close();
            this.emitTransferEvent({
                type: 'receive-complete',
                id: transfer.id,
                name: transfer.metadata.name,
                size: transfer.metadata.size,
                savedToDisk: true,
            });
        } else {
            const blob = new Blob(transfer.receiveBuffer, { type: transfer.metadata.mimeType });
            this.downloadBlob(blob, transfer.metadata.name);
            this.emitTransferEvent({
                type: 'receive-complete',
                id: transfer.id,
                name: transfer.metadata.name,
                size: transfer.metadata.size,
                savedToDisk: false,
            });
        }

        this.currentIncomingTransfer = null;
    }

    async cancelIncomingTransfer(id) {
        if (!this.currentIncomingTransfer || this.currentIncomingTransfer.id !== id) {
            return;
        }

        if (this.currentIncomingTransfer.fileWriter) {
            await this.currentIncomingTransfer.fileWriter.abort();
        }

        this.currentIncomingTransfer = null;
        this.emitTransferEvent({ type: 'receive-cancel', id });
    }

    downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    calculateSpeed(currentBytes, totalBytes = null) {
        const now = Date.now();
        if (this.speedStats.lastTime === 0) {
            this.speedStats.lastTime = now;
            this.speedStats.lastBytes = currentBytes;
            return 0;
        }

        const timeDiff = (now - this.speedStats.lastTime) / 1000;
        const bytesDiff = currentBytes - this.speedStats.lastBytes;

        if (timeDiff >= 0.5 && bytesDiff > 0) {
            const instantSpeed = bytesDiff / timeDiff;
            this.updateSpeedStats(instantSpeed);
            this.speedStats.lastTime = now;
            this.speedStats.lastBytes = currentBytes;
        }

        return this.speedStats.currentSpeed;
    }

    emitTransferEvent(event) {
        if (this.onTransferEvent) {
            this.onTransferEvent(event);
        }
    }

    close() {
        this.isIntentionalClose = true;
        this.stopHeartbeat();
        this.resetPeerConnection();

        if (this.ws) {
            this.ws.close();
        }
    }
}

class App {
    constructor() {
        this.connection = null;
        this.role = null;
        this.currentCode = '';
        this.sessionStorageKey = '0trace:session';
        this.sendQueue = [];
        this.isSending = false;
        this.fileSequence = 0;
        this.transferNodes = new Map();
        this.lastAnnouncedStatus = null;

        this.init();
    }

    async init() {
        await i18n.init();
        this.cacheElements();
        this.initModals();
        this.initUI();
        this.updateLanguageControls();
        this.checkURLParams();
    }

    cacheElements() {
        this.elements = {
            createRoomBtn: document.getElementById('create-room-btn'),
            joinBtn: document.getElementById('join-btn'),
            copyLinkBtn: document.getElementById('copy-link-btn'),
            logoLink: document.getElementById('logo-link'),
            langSelect: document.getElementById('lang-select'),
            codeBoxes: Array.from(document.querySelectorAll('.code-box')),
            setupShell: document.getElementById('setup-shell'),
            sessionPanel: document.getElementById('session-panel'),
            shareCard: document.getElementById('share-card'),
            shareCode: document.getElementById('share-code'),
            shareLink: document.getElementById('share-link'),
            sessionCodeLine: document.getElementById('session-code-line'),
            sessionRoleLabel: document.getElementById('session-role-label'),
            sessionStatusText: document.getElementById('session-status-text'),
            sessionStatusBadge: document.getElementById('session-status-badge'),
            connectionQuality: document.getElementById('connection-quality'),
            networkWarning: document.getElementById('network-warning'),
            roomExpiryNote: document.getElementById('room-expiry-note'),
            messageList: document.getElementById('message-list'),
            emptyState: document.getElementById('empty-state'),
            chatInput: document.getElementById('chat-input'),
            sendChatBtn: document.getElementById('send-chat-btn'),
            attachBtn: document.getElementById('attach-btn'),
            fileInput: document.getElementById('file-input'),
        };
    }

    initModals() {
        const privacyLink = document.getElementById('privacy-link');
        const termsLink = document.getElementById('terms-link');
        const privacyModal = document.getElementById('privacy-modal');
        const termsModal = document.getElementById('terms-modal');

        privacyLink.addEventListener('click', (event) => {
            event.preventDefault();
            privacyModal.classList.add('show');
        });

        termsLink.addEventListener('click', (event) => {
            event.preventDefault();
            termsModal.classList.add('show');
        });

        document.querySelectorAll('.close').forEach((closeBtn) => {
            closeBtn.addEventListener('click', () => {
                privacyModal.classList.remove('show');
                termsModal.classList.remove('show');
            });
        });

        window.addEventListener('click', (event) => {
            if (event.target === privacyModal) {
                privacyModal.classList.remove('show');
            }
            if (event.target === termsModal) {
                termsModal.classList.remove('show');
            }
        });
    }

    initUI() {
        this.elements.langSelect.addEventListener('change', async (event) => {
            await i18n.switchLanguage(event.target.value);
        });

        window.addEventListener('languageChanged', () => {
            this.updateLanguageControls();
            this.updateDynamicText();
        });

        this.elements.createRoomBtn.addEventListener('click', () => this.createSession());
        this.elements.joinBtn.addEventListener('click', () => {
            const code = this.getCodeFromInputs();
            if (code.length !== 6) {
                this.showToast(i18n.t('session.invalidCode'), 'error');
                return;
            }
            this.joinSession(code);
        });

        this.elements.copyLinkBtn.addEventListener('click', async () => {
            if (!this.currentCode) {
                return;
            }

            await navigator.clipboard.writeText(this.getShareUrl(this.currentCode));
            this.showToast(i18n.t('session.linkCopied'));
        });

        // 重试连接按钮
        this.elements.retryConnectionBtn = document.getElementById('retry-connection-btn');
        this.elements.retryConnectionBtn.addEventListener('click', () => {
            this.retryConnection().catch((error) => {
                console.error('Retry connection error:', error);
                this.showToast(i18n.t('session.joinFailed'), 'error');
            });
        });

        this.elements.logoLink.addEventListener('click', (event) => {
            if (window.location.search || this.connection) {
                event.preventDefault();
                this.resetApp();
            }
        });

        this.elements.codeBoxes.forEach((box, index) => {
            box.addEventListener('input', (event) => {
                // 支持字母和数字，自动转为大写
                const value = event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                event.target.value = value;

                if (value && index < this.elements.codeBoxes.length - 1) {
                    this.elements.codeBoxes[index + 1].focus();
                }
            });

            box.addEventListener('keydown', (event) => {
                if (event.key === 'Backspace' && !event.target.value && index > 0) {
                    this.elements.codeBoxes[index - 1].focus();
                }
            });

            box.addEventListener('paste', (event) => {
                event.preventDefault();
                const pasted = (event.clipboardData.getData('text') || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
                this.fillCodeBoxes(pasted);
            });
        });

        this.elements.sendChatBtn.addEventListener('click', () => this.sendChat());
        this.elements.chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendChat();
            }
        });

        this.elements.attachBtn.addEventListener('click', () => {
            if (!this.connection) {
                this.showToast(i18n.t('session.startFirst'), 'error');
                return;
            }
            this.elements.fileInput.click();
        });

        this.elements.fileInput.addEventListener('change', (event) => {
            const files = Array.from(event.target.files || []);
            this.enqueueFiles(files);
            event.target.value = '';
        });

        this.elements.messageList.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (this.connection) {
                this.elements.messageList.classList.add('dragover');
            }
        });

        this.elements.messageList.addEventListener('dragleave', () => {
            this.elements.messageList.classList.remove('dragover');
        });

        this.elements.messageList.addEventListener('drop', (event) => {
            event.preventDefault();
            this.elements.messageList.classList.remove('dragover');
            const files = Array.from(event.dataTransfer.files || []);
            this.enqueueFiles(files);
        });
    }

    updateLanguageControls() {
        this.elements.langSelect.value = i18n.getCurrentLang();
    }

    updateDynamicText() {
        this.updateStatusBadge(this.connection ? this.connection.status : 'disconnected');
        this.updateRoleLabel();
        if (this.currentCode) {
            this.updateShareInfo();
        }
    }

    checkURLParams() {
        const params = new URLSearchParams(window.location.search);
        const code = (params.get('code') || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
        if (code.length !== 6) {
            return;
        }

        this.fillCodeBoxes(code);
        this.openExistingSession(code, this.resolveStoredRole(code));
    }

    async retryConnection() {
        if (this.currentCode && this.role) {
            this.connection?.close();
            this.elements.retryConnectionBtn.classList.add('hidden');
            if (this.role === 'sender') {
                const roomStatus = await this.fetchRoomStatus(this.currentCode);
                if (roomStatus && roomStatus.success) {
                    this.openExistingSession(this.currentCode, this.role);
                    return;
                }

                this.createSession();
                return;
            }

            this.openExistingSession(this.currentCode, this.role);
            return;
        }

        this.resetApp();
        this.showToast(i18n.t('session.startFirst'), 'error');
    }

    async createSession() {
        this.resetSessionState();
        this.role = 'sender';
        this.showSessionPanel();
        this.createConnection();
        this.updateRoleLabel();
        this.appendSystemMessage(i18n.t('session.creatingSystem'));

        try {
            const code = await this.connection.createRoom();
            this.currentCode = code;
            this.persistSession();
            this.syncRoomUrl(code);
            this.updateShareInfo();
            this.elements.shareCard.classList.remove('hidden');
            this.updateStatusBadge('waiting');
            this.appendSystemMessage(i18n.t('session.createdSystem'));
        } catch (error) {
            console.error('Create session error:', error);
            this.showToast(i18n.t('session.createFailed'), 'error');
            this.appendSystemMessage(i18n.t('session.createFailed'));
        }
    }

    async joinSession(code) {
        this.resetSessionState();
        this.role = 'receiver';
        this.currentCode = code;
        this.persistSession();
        this.syncRoomUrl(code);
        this.showSessionPanel();
        this.createConnection();
        this.updateRoleLabel();
        this.updateShareInfo();
        this.appendSystemMessage(i18n.t('session.joiningSystem'));

        try {
            await this.connection.joinRoom(code);
            this.appendSystemMessage(i18n.t('session.joinedSystem'));
        } catch (error) {
            console.error('Join session error:', error);
            this.showToast(i18n.t('session.joinFailed'), 'error');
            this.appendSystemMessage(i18n.t('session.joinFailed'));
        }
    }

    async openExistingSession(code, role) {
        if (!this.isValidRoomCode(code)) {
            this.resetApp();
            this.showToast(i18n.t('session.invalidCode'), 'error');
            return;
        }

        this.resetSessionState();
        this.role = role;
        this.currentCode = code;
        this.persistSession();
        this.syncRoomUrl(code);
        this.showSessionPanel();
        this.createConnection();
        this.updateRoleLabel();
        this.updateShareInfo();
        if (role === 'sender') {
            this.elements.shareCard.classList.remove('hidden');
        }
        this.appendSystemMessage(i18n.t('session.restoringSystem'));

        try {
            await this.connection.attachToRoom(code, role);
            this.appendSystemMessage(i18n.t('session.restoredSystem'));
        } catch (error) {
            console.error('Restore session error:', error);
            this.resetApp();
            this.showToast(i18n.t('session.joinFailed'), 'error');
        }
    }

    createConnection() {
        this.connection = new WebRTCConnection();
        this.connection.onStatusChange = (status, metrics) => this.handleStatusChange(status, metrics);
        this.connection.onChatMessage = (message) => this.handleIncomingChat(message);
        this.connection.onTransferEvent = (event) => this.handleTransferEvent(event);
        this.connection.onError = (message) => {
            this.showToast(message, 'error');
            this.appendSystemMessage(message);
        };
    }

    resetSessionState() {
        if (this.connection) {
            this.connection.close();
        }

        this.connection = null;
        this.currentCode = '';
        this.role = null;
        this.sendQueue = [];
        this.isSending = false;
        this.transferNodes.clear();
        this.lastAnnouncedStatus = null;

        this.elements.messageList.innerHTML = '';
        this.elements.messageList.appendChild(this.elements.emptyState);
        this.elements.emptyState.classList.remove('hidden');
        this.elements.shareCard.classList.add('hidden');
        this.elements.networkWarning.classList.add('hidden');
        this.elements.chatInput.value = '';
    }

    resetApp() {
        this.resetSessionState();
        this.clearPersistedSession();
        this.syncRoomUrl('');
        this.fillCodeBoxes('');
        this.elements.setupShell.classList.remove('hidden');
        this.elements.sessionPanel.classList.add('hidden');
        this.updateStatusBadge('disconnected');
        window.history.pushState({}, '', window.location.pathname);
    }

    showSessionPanel() {
        this.elements.setupShell.classList.add('hidden');
        this.elements.sessionPanel.classList.remove('hidden');
        this.updateStatusBadge('connecting');
    }

    updateShareInfo() {
        const formattedCode = this.formatCode(this.currentCode);
        this.elements.sessionCodeLine.textContent = `${i18n.t('session.codeLabel')} · ${formattedCode}`;
        this.elements.shareCode.textContent = formattedCode;
        this.elements.shareLink.textContent = this.getShareUrl(this.currentCode);
    }

    updateRoleLabel() {
        if (!this.role) {
            this.elements.sessionRoleLabel.textContent = '';
            return;
        }

        this.elements.sessionRoleLabel.textContent = this.role === 'sender'
            ? i18n.t('session.roleHost')
            : i18n.t('session.roleGuest');
    }

    handleStatusChange(status, metrics) {
        // 处理连接质量状态
        if (status.startsWith('quality-')) {
            const quality = status.replace('quality-', '');
            this.updateConnectionQuality(quality, metrics);
            return;
        }

        this.updateStatusBadge(status);
        this.updateRoomExpiryHint(status);

        if (status === 'connected') {
            this.elements.networkWarning.classList.add('hidden');
            this.elements.retryConnectionBtn.classList.add('hidden');
            this.processSendQueue();
            // 开始监控连接质量
            if (this.connection) {
                this.connection.startStatsMonitoring();
            }
        } else if (status === 'failed' || status === 'disconnected') {
            this.elements.networkWarning.classList.remove('hidden');
            this.elements.retryConnectionBtn.classList.remove('hidden');
            // 停止监控
            if (this.connection) {
                this.connection.stopStatsMonitoring();
            }
        } else if (status === 'reconnecting') {
            this.elements.networkWarning.classList.remove('hidden');
            this.elements.retryConnectionBtn.classList.add('hidden');
            // 停止监控
            if (this.connection) {
                this.connection.stopStatsMonitoring();
            }
        }

        if (status !== this.lastAnnouncedStatus) {
            const messages = {
                connected: i18n.t('session.connectedSystem'),
                reconnecting: i18n.t('session.reconnecting'),
                failed: i18n.t('session.failedSystem'),
                'peer-left': i18n.t('session.peerLeftSystem'),
            };

            if (messages[status]) {
                this.appendSystemMessage(messages[status]);
            }
            this.lastAnnouncedStatus = status;
        }
    }

    updateRoomExpiryHint(status) {
        if (!this.elements.roomExpiryNote) {
            return;
        }

        const shouldShow = status === 'peer-left' || status === 'disconnected' || status === 'failed';
        this.elements.roomExpiryNote.classList.toggle('hidden', !shouldShow);
    }

    updateConnectionQuality(quality, metrics) {
        const indicators = {
            good: this.elements.connectionQuality.querySelector('[data-quality="good"]'),
            fair: this.elements.connectionQuality.querySelector('[data-quality="fair"]'),
            poor: this.elements.connectionQuality.querySelector('[data-quality="poor"]')
        };

        // 隐藏所有指示器
        Object.values(indicators).forEach(indicator => {
            if (indicator) indicator.classList.add('hidden');
        });

        // 显示对应质量的指示器
        if (indicators[quality]) {
            indicators[quality].classList.remove('hidden');
        }

        // 可选：在tooltip中显示详细指标
        if (metrics) {
            const tooltip = `RTT: ${Math.round(metrics.rtt * 1000)}ms, Loss: ${metrics.loss.toFixed(1)}%`;
            this.elements.connectionQuality.title = tooltip;
        }
    }

    updateStatusBadge(status) {
        const statusMap = {
            waiting: i18n.t('session.waitingPeer'),
            connecting: i18n.t('session.connecting'),
            reconnecting: i18n.t('session.reconnecting'),
            connected: i18n.t('session.connected'),
            disconnected: i18n.t('session.disconnected'),
            failed: i18n.t('session.failed'),
            'peer-left': i18n.t('session.peerLeft'),
        };

        const text = statusMap[status] || statusMap.waiting;
        this.elements.sessionStatusText.textContent = text;

        this.elements.sessionStatusBadge.classList.remove('is-connected', 'is-warning', 'is-error');
        if (status === 'connected') {
            this.elements.sessionStatusBadge.classList.add('is-connected');
        } else if (status === 'failed' || status === 'peer-left') {
            this.elements.sessionStatusBadge.classList.add('is-error');
        } else if (status === 'disconnected' || status === 'reconnecting') {
            this.elements.sessionStatusBadge.classList.add('is-warning');
        }
    }

    async sendChat() {
        const text = this.elements.chatInput.value.trim();
        if (!text) {
            return;
        }

        if (!this.connection || !this.connection.isTransportReady()) {
            this.showToast(i18n.t('session.waitForConnection'), 'error');
            return;
        }

        try {
            this.connection.sendChatMessage(text);
            this.appendChatMessage({
                text,
                ts: Date.now(),
                outgoing: true,
            });
            this.elements.chatInput.value = '';
        } catch (error) {
            console.error('Send chat error:', error);
            this.showToast(i18n.t('session.sendFailed'), 'error');
        }
    }

    handleIncomingChat(message) {
        this.appendChatMessage({
            text: message.text,
            ts: message.ts || Date.now(),
            outgoing: false,
        });
    }

    enqueueFiles(files) {
        if (!files.length) {
            return;
        }

        if (!this.connection) {
            this.showToast(i18n.t('session.startFirst'), 'error');
            return;
        }

        files.forEach((file) => {
            const id = this.nextTransferId();
            this.sendQueue.push({ id, file, status: 'queued' });
            this.addFileMessage({
                id,
                name: file.name,
                size: file.size,
                outgoing: true,
                statusText: i18n.t('session.fileQueued'),
                progress: 0,
            });
        });

        this.processSendQueue();
    }

    async processSendQueue() {
        if (this.isSending || !this.connection || !this.connection.isTransportReady()) {
            return;
        }

        const nextItem = this.sendQueue.find((item) => item.status === 'queued');
        if (!nextItem) {
            return;
        }

        this.isSending = true;
        nextItem.status = 'sending';
        this.updateFileMessage(nextItem.id, {
            statusText: i18n.t('session.fileSending'),
            progress: 0,
        });

        try {
            await this.connection.sendFile(nextItem.file, {
                id: nextItem.id,
                onProgress: ({ progress, speed, sentBytes, totalBytes }) => {
                    const eta = speed > 0 ? this.connection.calculateETA(totalBytes - sentBytes, speed) : null;
                    this.updateFileMessage(nextItem.id, {
                        progress,
                        statusText: `${i18n.t('session.fileSending')} · ${progress}%`,
                        detail: `${this.formatSize(sentBytes)} / ${this.formatSize(totalBytes)}${speed ? ` · ${this.formatSpeed(speed)}` : ''}${eta ? ` · ${eta}` : ''}`,
                    });
                },
            });

            nextItem.status = 'complete';
            this.updateFileMessage(nextItem.id, {
                progress: 100,
                statusText: i18n.t('session.fileSent'),
                detail: this.formatSize(nextItem.file.size),
            });
        } catch (error) {
            console.error('Send file error:', error);
            nextItem.status = 'failed';
            this.updateFileMessage(nextItem.id, {
                statusText: i18n.t('session.fileFailed'),
            });
            this.showToast(i18n.t('session.fileFailed'), 'error');
        } finally {
            this.isSending = false;
            this.processSendQueue();
        }
    }

    handleTransferEvent(event) {
        switch (event.type) {
            case 'receive-start':
                this.addFileMessage({
                    id: event.id,
                    name: event.name,
                    size: event.size,
                    outgoing: false,
                    statusText: i18n.t('session.fileReceiving'),
                    progress: 0,
                });
                break;

            case 'receive-progress': {
                const eta = event.speed > 0 ? this.connection.calculateETA(event.totalBytes - event.receivedBytes, event.speed) : null;
                this.updateFileMessage(event.id, {
                    progress: event.progress,
                    statusText: `${i18n.t('session.fileReceiving')} · ${event.progress}%`,
                    detail: `${this.formatSize(event.receivedBytes)} / ${this.formatSize(event.totalBytes)}${event.speed ? ` · ${this.formatSpeed(event.speed)}` : ''}${eta ? ` · ${eta}` : ''}`,
                });
                break;
            }

            case 'receive-complete':
                this.updateFileMessage(event.id, {
                    progress: 100,
                    statusText: event.savedToDisk ? i18n.t('session.fileSaved') : i18n.t('session.fileReceived'),
                    detail: this.formatSize(event.size),
                });
                this.showToast(i18n.t('session.receiveComplete'));
                break;

            case 'receive-cancel':
                this.updateFileMessage(event.id, {
                    statusText: i18n.t('session.fileCancelled'),
                });
                break;
        }
    }

    appendSystemMessage(text) {
        this.hideEmptyState();
        const item = document.createElement('div');
        item.className = 'timeline-system';
        item.textContent = text;
        this.elements.messageList.appendChild(item);
        this.scrollMessagesToBottom();
    }

    appendChatMessage({ text, ts, outgoing }) {
        this.hideEmptyState();
        const item = document.createElement('div');
        item.className = `timeline-item ${outgoing ? 'outgoing' : 'incoming'}`;

        const bubble = document.createElement('div');
        bubble.className = `bubble chat-bubble ${outgoing ? 'outgoing' : 'incoming'}`;

        const content = document.createElement('p');
        content.className = 'chat-text';
        content.textContent = text;

        const meta = document.createElement('span');
        meta.className = 'message-meta';
        meta.textContent = this.formatTime(ts);

        bubble.appendChild(content);
        bubble.appendChild(meta);
        item.appendChild(bubble);
        this.elements.messageList.appendChild(item);
        this.scrollMessagesToBottom();
    }

    addFileMessage({ id, name, size, outgoing, statusText, progress }) {
        this.hideEmptyState();

        const item = document.createElement('div');
        item.className = `timeline-item ${outgoing ? 'outgoing' : 'incoming'}`;

        const bubble = document.createElement('div');
        bubble.className = `bubble file-bubble ${outgoing ? 'outgoing' : 'incoming'}`;

        const titleRow = document.createElement('div');
        titleRow.className = 'file-title-row';

        const icon = document.createElement('span');
        icon.className = 'file-icon';
        icon.textContent = '📎';

        const title = document.createElement('span');
        title.className = 'file-name';
        title.textContent = name;

        titleRow.appendChild(icon);
        titleRow.appendChild(title);

        const detail = document.createElement('div');
        detail.className = 'file-detail';
        detail.textContent = this.formatSize(size);

        const progressBar = document.createElement('div');
        progressBar.className = 'file-progress';

        const progressFill = document.createElement('div');
        progressFill.className = 'file-progress-fill';
        progressFill.style.width = `${progress}%`;
        progressBar.appendChild(progressFill);

        const status = document.createElement('div');
        status.className = 'file-status';
        status.textContent = statusText;

        bubble.appendChild(titleRow);
        bubble.appendChild(detail);
        bubble.appendChild(progressBar);
        bubble.appendChild(status);
        item.appendChild(bubble);
        this.elements.messageList.appendChild(item);

        this.transferNodes.set(id, {
            detailNode: detail,
            progressFillNode: progressFill,
            statusNode: status,
        });

        this.scrollMessagesToBottom();
    }

    updateFileMessage(id, { progress, statusText, detail } = {}) {
        const nodes = this.transferNodes.get(id);
        if (!nodes) {
            return;
        }

        if (typeof progress === 'number') {
            nodes.progressFillNode.style.width = `${progress}%`;
        }

        if (statusText) {
            nodes.statusNode.textContent = statusText;
        }

        if (detail) {
            nodes.detailNode.textContent = detail;
        }

        this.scrollMessagesToBottom();
    }

    hideEmptyState() {
        this.elements.emptyState.classList.add('hidden');
    }

    scrollMessagesToBottom() {
        this.elements.messageList.scrollTop = this.elements.messageList.scrollHeight;
    }

    fillCodeBoxes(code) {
        this.elements.codeBoxes.forEach((box, index) => {
            box.value = code[index] || '';
        });
    }

    getCodeFromInputs() {
        return this.elements.codeBoxes.map((box) => box.value).join('');
    }

    nextTransferId() {
        this.fileSequence += 1;
        return `file-${Date.now()}-${this.fileSequence}`;
    }

    getShareUrl(code) {
        return `${window.location.origin}/?code=${code}`;
    }

    async fetchRoomStatus(code) {
        if (!this.isValidRoomCode(code)) {
            return null;
        }

        try {
            const response = await fetch(`/api/room-info?code=${encodeURIComponent(code)}`);
            if (!response.ok) {
                return null;
            }
            return await response.json();
        } catch (error) {
            console.warn('Failed to fetch room status:', error);
            return null;
        }
    }

    persistSession() {
        if (!this.currentCode || !this.role) {
            return;
        }

        sessionStorage.setItem(this.sessionStorageKey, JSON.stringify({
            code: this.currentCode,
            role: this.role,
        }));
    }

    clearPersistedSession() {
        sessionStorage.removeItem(this.sessionStorageKey);
    }

    resolveStoredRole(code) {
        try {
            const raw = sessionStorage.getItem(this.sessionStorageKey);
            if (!raw) {
                return 'receiver';
            }

            const saved = JSON.parse(raw);
            if (
                saved.code === code &&
                this.isValidRoomCode(saved.code) &&
                (saved.role === 'sender' || saved.role === 'receiver')
            ) {
                return saved.role;
            }
        } catch (error) {
            console.warn('Failed to restore saved session state:', error);
        }

        return 'receiver';
    }

    syncRoomUrl(code) {
        const url = new URL(window.location.href);
        if (code) {
            url.searchParams.set('code', code);
        } else {
            url.searchParams.delete('code');
        }
        const search = url.searchParams.toString();
        const nextUrl = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
        window.history.replaceState({}, '', nextUrl);
    }

    isValidRoomCode(code) {
        return /^[A-Z0-9]{6}$/i.test(code || '');
    }

    formatCode(code) {
        if (!code) {
            return '';
        }
        return `${code.slice(0, 4)}-${code.slice(4)}`;
    }

    formatTime(ts) {
        return new Date(ts).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    formatSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }

    formatSpeed(bytesPerSecond) {
        if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
        if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        return `${(bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s`;
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 2029);
    }
}

new App();
