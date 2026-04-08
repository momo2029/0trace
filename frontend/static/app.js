// WebRTC 连接管理
class WebRTCConnection {
    constructor() {
        this.pc = null;
        this.dc = null;
        this.ws = null;
        this.role = null;
        this.code = null;
        this.onFileReceive = null;
        this.onProgress = null;
        this.onStatusChange = null;

        // 接收缓冲区
        this.receiveBuffer = [];
        this.receivedSize = 0;
        this.fileMetadata = null;

        // 速度统计
        this.speedStats = {
            lastTime: 0,
            lastBytes: 0,
            currentSpeed: 0
        };

        // 流式写入
        this.fileWriter = null;
        this.useStreaming = false;

        // 保活机制
        this.heartbeatInterval = null;
        this.reconnectAttempts = 0;
        this.isIntentionalClose = false;
    }

    // 创建房间
    async createRoom() {
        const response = await fetch('/api/create-room', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            this.code = data.code;
            await this.connect('sender');
            return data.code;
        }
        throw new Error('Failed to create room');
    }

    // 加入房间
    async joinRoom(code) {
        this.code = code;
        await this.connect('receiver');
    }

    // 建立 WebSocket 连接
    async connect(role) {
        this.role = role;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws?code=${this.code}&role=${role}`;

        this.ws = new WebSocket(wsUrl);

        return new Promise((resolve, reject) => {
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                // 只在首次连接时建立 PeerConnection
                if (!this.pc) {
                    this.setupPeerConnection();
                }
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onmessage = (event) => {
                this.handleSignalMessage(JSON.parse(event.data));
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.stopHeartbeat();

                if (!this.isIntentionalClose) {
                    this.reconnectAttempts++;
                    // 指数退避，最长 30 秒
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
                    console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
                    setTimeout(() => this.reconnectWS(), delay);
                } else {
                    this.updateStatus('disconnected');
                }
            };

            // 启动心跳
            this.startHeartbeat();
        });
    }

    // 仅重连 WebSocket，不重建 PeerConnection
    reconnectWS() {
        if (this.isIntentionalClose) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws?code=${this.code}&role=${this.role}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket reconnected');
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            // 如果 WebRTC 还没连上，重新触发信令（发送方等 peer-joined，接收方等 offer）
            if (!this.dc || this.dc.readyState !== 'open') {
                if (this.role === 'sender' && this.pc) {
                    // 重置 PeerConnection 等待新的接收方
                    this.pc.close();
                    this.pc = null;
                    this.dc = null;
                    this.setupPeerConnection();
                }
            }
        };

        this.ws.onmessage = (event) => {
            this.handleSignalMessage(JSON.parse(event.data));
        };

        this.ws.onclose = () => {
            this.stopHeartbeat();
            if (!this.isIntentionalClose) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
                console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
                setTimeout(() => this.reconnectWS(), delay);
            }
        };

        this.ws.onerror = () => {};
    }

    // 启动心跳保活
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000); // 每 30 秒发送一次心跳
    }

    // 停止心跳
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // 设置 PeerConnection
    setupPeerConnection() {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                { urls: 'stun:stun.qq.com:3478' },
            ]
        };

        this.pc = new RTCPeerConnection(config);

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE Candidate:', event.candidate.type, event.candidate.candidate);
                this.sendSignal({
                    type: 'ice-candidate',
                    candidate: JSON.stringify(event.candidate)
                });
            }
        };

        this.pc.onconnectionstatechange = () => {
            console.log('Connection state:', this.pc.connectionState);
            console.log('ICE connection state:', this.pc.iceConnectionState);
            console.log('ICE gathering state:', this.pc.iceGatheringState);
            this.updateStatus(this.pc.connectionState);

            // WebRTC 连接断开时尝试重连
            if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
                console.log('WebRTC connection lost, attempting to reconnect...');
                setTimeout(() => {
                    if (this.pc.connectionState !== 'connected') {
                        this.restartIce();
                    }
                }, 3000);
            }
        };

        this.pc.onicecandidateerror = (event) => {
            // 忽略 STUN 服务器失败（有多个备用）
            if (event.errorCode === 701) {
                console.log('STUN server unreachable (using fallback):', event.url);
            } else {
                console.error('ICE Candidate Error:', event);
            }
        };

        if (this.role === 'sender') {
            // 发送方创建 DataChannel
            this.dc = this.pc.createDataChannel('file-transfer');
            this.setupDataChannel();
            // 不要立即创建 offer，等收到 peer-joined 后再创建
        } else {
            // 接收方等待 DataChannel
            this.pc.ondatachannel = (event) => {
                this.dc = event.channel;
                this.setupDataChannel();
            };
        }
    }

    // 设置 DataChannel
    setupDataChannel() {
        this.dc.onopen = () => {
            console.log('DataChannel opened');
            this.updateStatus('connected');
        };

        this.dc.onclose = () => {
            console.log('DataChannel closed');
            this.updateStatus('disconnected');
        };

        this.dc.onmessage = (event) => {
            if (typeof event.data === 'string') {
                this.handleDataMessage(JSON.parse(event.data));
            } else {
                this.handleFileChunk(event.data);
            }
        };
    }

    // 创建 Offer
    async createOffer() {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.sendSignal({
            type: 'offer',
            sdp: offer.sdp
        });
    }

    // 处理信令消息
    async handleSignalMessage(message) {
        console.log('Signal message:', message.type);

        switch (message.type) {
            case 'peer-joined':
                console.log('Peer joined');
                // 如果是发送方，收到对方加入后才创建 offer
                if (this.role === 'sender') {
                    this.createOffer();
                }
                break;

            case 'offer':
                await this.pc.setRemoteDescription({
                    type: 'offer',
                    sdp: message.sdp
                });
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                this.sendSignal({
                    type: 'answer',
                    sdp: answer.sdp
                });
                break;

            case 'answer':
                await this.pc.setRemoteDescription({
                    type: 'answer',
                    sdp: message.sdp
                });
                break;

            case 'ice-candidate':
                const candidate = JSON.parse(message.candidate);
                await this.pc.addIceCandidate(candidate);
                break;

            case 'peer-left':
                this.updateStatus('peer-left');
                break;

            case 'error':
                console.error('Signal error:', message.message);
                break;
        }
    }

    // 发送信令消息
    sendSignal(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    // 发送文件
    async sendFile(file) {
        if (!this.dc || this.dc.readyState !== 'open') {
            throw new Error('DataChannel not ready');
        }

        // 发送文件元信息
        const metadata = {
            type: 'file-meta',
            name: file.name,
            size: file.size,
            mimeType: file.type
        };
        this.dc.send(JSON.stringify(metadata));

        // 分块发送
        const chunkSize = 256 * 1024; // 256KB
        const totalChunks = Math.ceil(file.size / chunkSize);
        let sentBytes = 0;

        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);

            // 发送块信息
            this.dc.send(JSON.stringify({
                type: 'chunk-info',
                index: i,
                total: totalChunks
            }));

            // 发送块数据
            const arrayBuffer = await chunk.arrayBuffer();
            this.dc.send(arrayBuffer);

            sentBytes += arrayBuffer.byteLength;
            this.calculateSpeed(sentBytes);

            // 更新进度
            const progress = Math.round(((i + 1) / totalChunks) * 100);
            this.updateProgress(progress);

            // 等待一下，避免发送过快
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // 发送完成消息
        this.dc.send(JSON.stringify({ type: 'complete' }));
        console.log('File sent successfully');
    }

    // 处理 DataChannel 消息
    handleDataMessage(message) {
        switch (message.type) {
            case 'file-meta':
                this.fileMetadata = message;
                this.receiveBuffer = [];
                this.receivedSize = 0;

                // 大文件使用流式写入
                if (message.size > 100 * 1024 * 1024) { // > 100MB
                    this.initStreamingDownload(message);
                }

                if (this.onFileReceive) {
                    this.onFileReceive({ type: 'meta', data: message });
                }
                break;

            case 'chunk-info':
                // 块信息，可用于显示进度
                break;

            case 'complete':
                if (this.useStreaming) {
                    this.finalizeStreamingDownload();
                } else {
                    this.assembleFile();
                }
                break;
        }
    }

    // 处理文件块
    async handleFileChunk(arrayBuffer) {
        if (this.useStreaming && this.fileWriter) {
            // 流式写入磁盘
            try {
                await this.fileWriter.write(arrayBuffer);
                this.receivedSize += arrayBuffer.byteLength;
                this.calculateSpeed(this.receivedSize);

                if (this.fileMetadata) {
                    const progress = Math.round((this.receivedSize / this.fileMetadata.size) * 100);
                    this.updateProgress(progress);
                }
            } catch (error) {
                console.error('Stream write error:', error);
                // 降级到内存模式
                this.useStreaming = false;
                this.receiveBuffer.push(arrayBuffer);
            }
        } else {
            // 内存模式
            this.receiveBuffer.push(arrayBuffer);
            this.receivedSize += arrayBuffer.byteLength;
            this.calculateSpeed(this.receivedSize);

            if (this.fileMetadata) {
                const progress = Math.round((this.receivedSize / this.fileMetadata.size) * 100);
                this.updateProgress(progress);
            }
        }
    }

    // 组装文件
    assembleFile() {
        const blob = new Blob(this.receiveBuffer, { type: this.fileMetadata.mimeType });

        // 触发下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileMetadata.name;
        a.click();
        URL.revokeObjectURL(url);

        if (this.onFileReceive) {
            this.onFileReceive({ type: 'complete', data: blob });
        }

        console.log('File received successfully');
    }

    // 初始化流式下载
    async initStreamingDownload(metadata) {
        try {
            // 检查浏览器支持
            if (!window.showSaveFilePicker) {
                console.log('Browser does not support File System Access API, using memory mode');
                this.useStreaming = false;
                return;
            }

            // 请求用户选择保存位置
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: metadata.name,
                types: [{
                    description: 'File',
                    accept: { [metadata.mimeType || 'application/octet-stream']: [] }
                }]
            });

            this.fileWriter = await fileHandle.createWritable();
            this.useStreaming = true;
            console.log('Streaming mode enabled');
        } catch (error) {
            console.log('User cancelled or error:', error);
            this.useStreaming = false;
        }
    }

    // 完成流式下载
    async finalizeStreamingDownload() {
        if (this.fileWriter) {
            try {
                await this.fileWriter.close();
                console.log('File saved successfully');

                if (this.onFileReceive) {
                    this.onFileReceive({ type: 'complete' });
                }
            } catch (error) {
                console.error('Error closing file:', error);
            }
            this.fileWriter = null;
        }
    }

    // 更新状态
    updateStatus(status) {
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
    }

    // 更新进度
    updateProgress(progress) {
        if (this.onProgress) {
            this.onProgress(progress, this.speedStats.currentSpeed);
        }
    }

    // 计算传输速度
    calculateSpeed(currentBytes) {
        const now = Date.now();
        if (this.speedStats.lastTime === 0) {
            this.speedStats.lastTime = now;
            this.speedStats.lastBytes = currentBytes;
            return 0;
        }

        const timeDiff = (now - this.speedStats.lastTime) / 1000; // 秒
        const bytesDiff = currentBytes - this.speedStats.lastBytes;

        if (timeDiff >= 0.5) { // 每0.5秒更新一次
            this.speedStats.currentSpeed = bytesDiff / timeDiff;
            this.speedStats.lastTime = now;
            this.speedStats.lastBytes = currentBytes;
        }

        return this.speedStats.currentSpeed;
    }

    // 重启 ICE（尝试恢复连接）
    restartIce() {
        if (!this.pc) return;

        console.log('Restarting ICE...');
        this.pc.restartIce();
    }

    // 关闭连接
    close() {
        this.isIntentionalClose = true;
        this.stopHeartbeat();
        if (this.dc) this.dc.close();
        if (this.pc) this.pc.close();
        if (this.ws) this.ws.close();
    }
}

// UI 控制
class App {
    constructor() {
        this.connection = null;
        this.selectedFile = null;
        this.init();
    }

    async init() {
        // 初始化 i18n
        await i18n.init();

        // 语言切换
        document.getElementById('lang-select').value = i18n.getCurrentLang();
        document.getElementById('lang-select').addEventListener('change', async (e) => {
            await i18n.switchLanguage(e.target.value);
        });

        // 监听语言变化事件
        window.addEventListener('languageChanged', () => {
            this.updateDynamicText();
        });

        // Modal 弹窗
        this.initModals();

        this.initUI();
    }

    initModals() {
        const privacyLink = document.getElementById('privacy-link');
        const termsLink = document.getElementById('terms-link');
        const privacyModal = document.getElementById('privacy-modal');
        const termsModal = document.getElementById('terms-modal');

        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            privacyModal.classList.add('show');
        });

        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            termsModal.classList.add('show');
        });

        // 关闭按钮
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                privacyModal.classList.remove('show');
                termsModal.classList.remove('show');
            });
        });

        // 点击外部关闭
        window.addEventListener('click', (e) => {
            if (e.target === privacyModal) {
                privacyModal.classList.remove('show');
            }
            if (e.target === termsModal) {
                termsModal.classList.remove('show');
            }
        });
    }

    initUI() {
        // 检查 URL 参数
        this.checkURLParams();

        // Tab 切换
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // 发送模式
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const folderInput = document.getElementById('folder-input');
        const selectFileBtn = document.getElementById('select-file-btn');
        const selectFolderBtn = document.getElementById('select-folder-btn');

        selectFileBtn.addEventListener('click', () => fileInput.click());
        selectFolderBtn.addEventListener('click', () => folderInput.click());

        // Logo 点击清除 URL 参数
        document.getElementById('logo-link').addEventListener('click', (e) => {
            if (window.location.search) {
                e.preventDefault();
                window.history.pushState({}, '', window.location.pathname);
                // 清空输入框
                document.querySelectorAll('.code-box').forEach(box => box.value = '');
                // 切换到发送模式
                this.switchTab('send');
            }
        });

        // 添加更多文件
        document.getElementById('add-more-btn').addEventListener('click', () => {
            fileInput.click();
        });

        // 清空所有文件
        document.getElementById('clear-all-btn').addEventListener('click', () => {
            this.selectedFiles = [];
            document.getElementById('file-list').classList.add('hidden');
            document.getElementById('upload-area').classList.remove('hidden');
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFilesSelect(Array.from(e.target.files));
            }
        });

        folderInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFilesSelect(Array.from(e.target.files));
            }
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');

            const items = e.dataTransfer.items;
            const files = [];

            // 处理拖拽的文件和文件夹
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    const item = items[i].webkitGetAsEntry();
                    if (item) {
                        if (item.isFile) {
                            items[i].getAsFile() && files.push(items[i].getAsFile());
                        } else if (item.isDirectory) {
                            // 文件夹拖拽暂不支持递归读取
                            this.showToast(i18n.t('send.folderDragNotSupported'), 'error');
                            return;
                        }
                    }
                }
                if (files.length > 0) {
                    this.handleFilesSelect(files);
                }
            } else if (e.dataTransfer.files.length > 0) {
                this.handleFilesSelect(Array.from(e.dataTransfer.files));
            }
        });

        // 复制按钮
        document.getElementById('copy-btn').addEventListener('click', () => {
            const codeText = document.getElementById('code-text').textContent;
            const code = codeText.replace('-', '');
            const shareUrl = `${window.location.origin}/?code=${code}`;
            navigator.clipboard.writeText(shareUrl);
            this.showToast(i18n.t('send.linkCopied'));
        });

        // 接收模式 - 取件码输入框
        const codeBoxes = document.querySelectorAll('.code-box');

        codeBoxes.forEach((box, index) => {
            // 输入时自动跳转到下一个框
            box.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value && /^\d$/.test(value)) {
                    // 跳过分隔符，找到下一个输入框
                    if (index < 7) {
                        codeBoxes[index + 1].focus();
                    } else {
                        // 第8位输入完成，自动加入房间
                        const code = Array.from(codeBoxes).map(box => box.value).join('');
                        if (code.length === 8 && /^\d{8}$/.test(code)) {
                            this.joinRoom(code);
                        }
                    }
                }
            });

            // 删除时跳转到上一个框
            box.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    codeBoxes[index - 1].focus();
                }
            });

            // 支持粘贴完整取件码
            box.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasteData = e.clipboardData.getData('text').replace(/\D/g, '');
                if (pasteData.length === 8) {
                    codeBoxes.forEach((b, i) => {
                        b.value = pasteData[i];
                    });
                    codeBoxes[7].focus();
                }
            });
        });

        // 接收模式 - 加入按钮
        document.getElementById('join-btn').addEventListener('click', () => {
            const code = Array.from(codeBoxes).map(box => box.value).join('');
            if (code.length === 8 && /^\d{8}$/.test(code)) {
                this.joinRoom(code);
            } else {
                this.showToast(i18n.t('receive.codePlaceholder'), 'error');
            }
        });
    }

    checkURLParams() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code && code.length === 8 && /^\d{8}$/.test(code)) {
            // 切换到接收模式
            this.switchTab('receive');
            // 自动填充取件码到输入框
            const codeBoxes = document.querySelectorAll('.code-box');
            codeBoxes.forEach((box, i) => {
                box.value = code[i];
            });
            // 自动加入房间
            setTimeout(() => {
                this.joinRoom(code);
            }, 500);
        }
    }

    switchTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}-panel`).classList.add('active');
    }

    async handleFilesSelect(files) {
        if (!files || files.length === 0) return;

        // 添加到已选文件列表（不覆盖）
        if (!this.selectedFiles) {
            this.selectedFiles = [];
        }
        this.selectedFiles = [...this.selectedFiles, ...Array.from(files)];

        // 更新文件列表显示
        this.updateFileList();

        // 如果还没有房间，创建房间
        if (!this.connection || !this.connection.code) {
            try {
                this.connection = new WebRTCConnection();
                this.connection.onStatusChange = (status) => this.updateSendStatus(status);
                this.connection.onProgress = (progress, speed) => this.updateSendProgress(progress, speed);

                const code = await this.connection.createRoom();

                // 显示取件码
                const codeTextEl = document.getElementById('code-text');
                if (codeTextEl) {
                    codeTextEl.textContent = code.slice(0, 4) + '-' + code.slice(4);
                }

                const roomCodeEl = document.getElementById('room-code');
                if (roomCodeEl) {
                    roomCodeEl.classList.remove('hidden');
                }

                const connectionStatusEl = document.getElementById('connection-status');
                if (connectionStatusEl) {
                    connectionStatusEl.classList.remove('hidden');
                }

                // 生成二维码
                const url = `${window.location.origin}/?code=${code}`;
                const qrcodeSticker = document.getElementById('qrcode');
                if (qrcodeSticker) {
                    qrcodeSticker.innerHTML = '';
                    qrcodeSticker.classList.remove('hidden');
                    new QRCode(qrcodeSticker, {
                        text: url,
                        width: 140,
                        height: 140,
                        colorDark: '#6366f1',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.M
                    });
                }

                // 等待连接后发送文件
                const checkConnection = setInterval(() => {
                    if (this.connection.dc && this.connection.dc.readyState === 'open') {
                        clearInterval(checkConnection);
                        this.sendFiles();
                        const progressEl = document.getElementById('progress');
                        if (progressEl) {
                            progressEl.classList.remove('hidden');
                        }
                    }
                }, 500);

            } catch (error) {
                console.error('Error:', error);
                this.showToast(i18n.t('send.createRoomFailed'), 'error');
            }
        }
    }

    updateFileList() {
        // 隐藏上传区域，显示文件列表
        document.getElementById('upload-area').classList.add('hidden');
        document.getElementById('file-list').classList.remove('hidden');

        const fileItems = document.getElementById('file-items');
        fileItems.innerHTML = '';

        this.selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-item-info">
                    <div class="file-item-icon">📄</div>
                    <div class="file-item-details">
                        <div class="file-item-name">${file.name}</div>
                        <div class="file-item-size">${this.formatSize(file.size)}</div>
                    </div>
                </div>
                <button class="file-item-remove" data-index="${index}">删除</button>
            `;
            fileItems.appendChild(item);
        });

        // 更新统计
        const totalSize = this.selectedFiles.reduce((sum, f) => sum + f.size, 0);
        document.getElementById('total-files').textContent = this.selectedFiles.length;
        document.getElementById('total-size').textContent = this.formatSize(totalSize);

        // 绑定删除按钮
        document.querySelectorAll('.file-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeFile(index);
            });
        });
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);

        if (this.selectedFiles.length === 0) {
            // 没有文件了，显示上传区域
            document.getElementById('file-list').classList.add('hidden');
            document.getElementById('upload-area').classList.remove('hidden');
        } else {
            this.updateFileList();
        }
    }

    async sendFiles() {
        for (let i = 0; i < this.selectedFiles.length; i++) {
            const file = this.selectedFiles[i];
            await this.connection.sendFile(file);

            // 如果有多个文件，显示进度
            if (this.selectedFiles.length > 1) {
                const overallProgress = Math.round(((i + 1) / this.selectedFiles.length) * 100);
                this.updateSendProgress(overallProgress);
            }
        }
        this.showToast(i18n.t('send.allFilesSent'));
    }

    async handleFileSelect(file) {
        // 兼容旧的单文件选择
        this.handleFilesSelect([file]);
    }

    async joinRoom(code) {
        try {
            this.connection = new WebRTCConnection();
            this.connection.onStatusChange = (status) => this.updateReceiveStatus(status);
            this.connection.onProgress = (progress, speed) => this.updateReceiveProgress(progress, speed);
            this.connection.onFileReceive = (event) => this.handleFileReceive(event);

            await this.connection.joinRoom(code);

            document.getElementById('receive-status').classList.remove('hidden');

        } catch (error) {
            console.error('Error:', error);
            alert('加入房间失败');
        }
    }

    handleFileReceive(event) {
        if (event.type === 'meta') {
            document.getElementById('receive-file-name').textContent = event.data.name;
            document.getElementById('receive-file-size').textContent = this.formatSize(event.data.size);
            document.getElementById('receive-info').classList.remove('hidden');
            document.getElementById('receive-progress').classList.remove('hidden');
        } else if (event.type === 'complete') {
            this.showToast(i18n.t('receive.complete'));
        }
    }

    updateSendStatus(status) {
        const statusMap = {
            'connecting': i18n.t('send.connecting'),
            'connected': i18n.t('send.connected'),
            'disconnected': i18n.t('send.disconnected'),
            'failed': i18n.t('send.failed')
        };
        document.getElementById('status-text').textContent = statusMap[status] || status;
    }

    updateReceiveStatus(status) {
        const statusMap = {
            'connecting': i18n.t('send.connecting'),
            'connected': i18n.t('receive.receiving'),
            'disconnected': i18n.t('send.disconnected'),
            'failed': i18n.t('send.failed')
        };
        document.getElementById('receive-status-text').textContent = statusMap[status] || status;
    }

    updateDynamicText() {
        // Update status text if visible
        if (this.connection) {
            const sendStatus = document.getElementById('status-text');
            const receiveStatus = document.getElementById('receive-status-text');

            if (sendStatus && !sendStatus.parentElement.parentElement.classList.contains('hidden')) {
                this.updateSendStatus(this.connection.pc?.connectionState || 'connecting');
            }

            if (receiveStatus && !receiveStatus.parentElement.parentElement.classList.contains('hidden')) {
                this.updateReceiveStatus(this.connection.pc?.connectionState || 'connecting');
            }
        }
    }

    updateSendProgress(progress, speed) {
        document.getElementById('progress-fill').style.width = `${progress}%`;
        let text = `${progress}%`;
        if (speed) {
            text += ` · ${this.formatSpeed(speed)}`;
        }
        document.getElementById('progress-text').textContent = text;
    }

    updateReceiveProgress(progress, speed) {
        document.getElementById('receive-progress-fill').style.width = `${progress}%`;
        let text = `${progress}%`;
        if (speed) {
            text += ` · ${this.formatSpeed(speed)}`;
        }
        document.getElementById('receive-progress-text').textContent = text;
    }

    formatSpeed(bytesPerSecond) {
        if (bytesPerSecond < 1024) {
            return `${bytesPerSecond.toFixed(0)} B/s`;
        } else if (bytesPerSecond < 1024 * 1024) {
            return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        } else {
            return `${(bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s`;
        }
    }

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }

    // Toast 提示
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

// 启动应用
new App();
