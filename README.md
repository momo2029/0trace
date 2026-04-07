# 0trace

> Zero-Privacy P2P File Transfer - WebRTC-based peer-to-peer file sharing

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

## ✨ Features

- 🔒 **Zero Privacy** - Files transferred via WebRTC P2P, server stores nothing
- 🚀 **Ultra Lightweight** - Rust backend < 5MB, pure JavaScript frontend, no frameworks
- 📦 **Ready to Use** - Open in browser, no registration or installation needed
- 🌐 **Cross-Network** - NAT traversal supported, not limited to LAN
- 🌍 **Multilingual** - Chinese, English, Japanese, Korean, Spanish, French
- ⚡ **Real-time Progress** - 256KB chunked transfer with live progress

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
make dev
```

## 📖 Usage

### Send Files

1. Open [0trace.org](https://0trace.org)
2. Select "Send Files" tab
3. Click or drag-drop files/folders
4. Click "Copy Link"
5. Share the link with receiver (WeChat/QQ/Email/etc.)

### Receive Files

**Method 1: Click Link (Recommended)**
- Receiver clicks the shared link
- Auto-receives, no manual steps needed

**Method 2: Manual Entry**
- Select "Receive Files" tab
- Enter 6-digit pickup code
- Click "Join Room"

## 🏗️ Architecture

```
Sender ←── WebSocket Signaling ──→ Rust Backend ←── WebSocket Signaling ──→ Receiver
   │                                                                             │
   └─────────────────────── WebRTC P2P Direct Transfer (File Data) ──────────────┘
```

**Tech Stack:**
- Backend: Rust + Axum + Tokio + WebSocket
- Frontend: Vanilla JavaScript + WebRTC API
- Protocol: WebRTC DataChannel + Custom Transfer Protocol

See [ARCHITECTURE.md](ARCHITECTURE.md) for details

## 🔒 Security

- ✅ WebRTC provides built-in DTLS/SRTP encryption
- ✅ Zero data retention on server (signaling only)
- ✅ Pickup code space 34^6 ≈ 1.5 billion combinations
- ✅ Room auto-expires after 1 hour

## ⚠️ Limitations

- Max 2 people per room (1 sender + 1 receiver)
- File size limited by browser memory
- Symmetric NAT requires TURN server (not configured by default)

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

## 🤝 Contributing

Issues and Pull Requests are welcome!

Please read [Contributing Guide](CONTRIBUTING.md) before submitting PRs

## 📧 Contact

- Project Homepage: https://github.com/momo2029/0trace
- Demo Site: https://0trace.org
- Issue Tracker: https://github.com/momo2029/0trace/issues
