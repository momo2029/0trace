# 0trace

> Zero-Trace P2P File Transfer - WebRTC-based peer-to-peer file sharing

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

## ✨ Features

- 🔒 **Zero Trace** - Files transferred via WebRTC P2P, server stores nothing
- 🚀 **Ultra Lightweight** - Rust backend < 5MB, pure JavaScript frontend, no frameworks
- 📦 **Ready to Use** - Open in browser, no registration or installation needed
- 🌐 **Cross-Network** - NAT traversal supported, not limited to LAN
- 🌍 **Multilingual** - Chinese, English, Japanese, Korean, Spanish, French
- ⚡ **Real-time Progress** - Live transfer speed display (MB/s) with progress tracking
- 📱 **QR Code Sharing** - Scan QR code on desktop for instant mobile access
- 💾 **Large File Support** - Streaming transfer up to 10GB+ using File System Access API
- 🔄 **Auto-Reconnect** - Connection keep-alive with automatic recovery on network issues
- 📋 **File Management** - Add/remove files without changing room code

## 🚀 Quick Start

### Use Online

Visit [0trace.org](https://0trace.org) to start transferring files immediately

### Local Deployment

**Method 1: Docker (Recommended)**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

Access http://localhost:2029

**Method 2: Build from Source**

```bash
# Clone repository
git clone https://github.com/momo2029/0trace
cd 0trace

# Run (requires Rust 1.75+)
./dev.sh
```

## 📖 Usage

### Send Files

1. Open [0trace.org](https://0trace.org)
2. Select "Send Files" tab
3. Click or drag-drop files/folders
4. Manage file list: add more files or remove unwanted ones
5. Copy link or scan QR code
6. Share with receiver (WeChat/QQ/Email/etc.)

### Receive Files

**Method 1: Click Link (Recommended)**
- Receiver clicks the shared link
- Auto-receives, no manual steps needed

**Method 2: Scan QR Code**
- Scan QR code with mobile device
- Opens directly in browser

**Method 3: Manual Entry**
- Select "Receive Files" tab
- Enter 8-digit pickup code in split input boxes
- Auto-joins room when all digits entered

## 🏗️ Architecture

```
Sender ←── WebSocket Signaling ──→ Rust Backend ←── WebSocket Signaling ──→ Receiver
   │                                                                             │
   └─────────────────────── WebRTC P2P Direct Transfer (File Data) ──────────────┘
```

**Tech Stack:**
- Backend: Rust + Axum + Tokio + WebSocket
- Frontend: Vanilla JavaScript + WebRTC API + File System Access API
- Protocol: WebRTC DataChannel + Custom Transfer Protocol
- Connection: Multiple STUN servers (Google, Cloudflare, QQ) with auto-reconnect

See [ARCHITECTURE.md](ARCHITECTURE.md) for details

## 🔒 Security

- ✅ WebRTC provides built-in DTLS/SRTP encryption
- ✅ Zero data retention on server (signaling only)
- ✅ Pickup code space 10^8 = 100 million combinations
- ✅ Room auto-expires after 5 minutes of inactivity
- ✅ Connection keep-alive with heartbeat mechanism

## ⚠️ Limitations

- Max 2 people per room (1 sender + 1 receiver)
- Large files (>100MB) require Chrome/Edge 86+ for streaming mode
- Symmetric NAT requires TURN server (not configured by default)

## 🆕 Recent Updates

### v2.0 (Latest)
- Changed room code from 6-char alphanumeric to 8-digit numbers
- Added split input boxes with auto-focus and paste support
- Implemented streaming file transfer for 10GB+ files
- Added real-time transfer speed display
- Added QR code sticker for mobile sharing
- Implemented file list management
- Added WebSocket heartbeat and auto-reconnect
- Added WebRTC ICE restart on connection failure
- Optimized mobile responsive design

## 🛠️ Development

See [CONTRIBUTING.md](CONTRIBUTING.md)

```bash
# Development mode (hot reload)
./dev.sh

# Run tests
make test

# Build for production
make build
```

## 📝 License

[MIT License](LICENSE)

## 🙏 Acknowledgments

- WebRTC technology for P2P communication
- QRCode.js for QR code generation
- Rust community for excellent tooling

## 🤝 Contributing

Issues and Pull Requests are welcome!

Please read [Contributing Guide](CONTRIBUTING.md) before submitting PRs

## 📧 Contact

- Project Homepage: https://github.com/momo2029/0trace
- Demo Site: https://0trace.org
- Issue Tracker: https://github.com/momo2029/0trace/issues
