# 0trace

> Pure P2P browser chat and file transfer for two people

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

## Features

- Pure P2P WebRTC transfer, with no file relay through the server
- One shared session for both chat and file transfer
- No account, no install, open in the browser and use it
- Two-person flow with room code or share link
- Human-friendly 6-character room codes like `BOOK23`
- URL includes `?code=ROOMCODE` so refresh can restore the room context
- Large file streaming support in modern browsers
- Multilingual UI: Chinese, English, Japanese, Korean, Spanish, French

## Quick Start

### Use Online

Visit [0trace.org](https://0trace.org)

### Local Deployment

**Method 1: Docker**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

Then open `http://localhost:2029`.

**Method 2: Build from Source**

```bash
git clone https://github.com/momo2029/0trace
cd 0trace
./dev.sh
```

## How It Works

1. One side creates a room.
2. 0trace generates a 6-character room code and a share link.
3. The other side opens the link or enters the room code.
4. Both browsers establish a direct WebRTC connection.
5. Chat messages and files appear in the same conversation timeline.

If the page is refreshed, the URL keeps the `?code=` parameter so the same browser can try to restore that room. If both sides leave and the room stays empty, it expires automatically after about 5 minutes.

## Product Positioning

0trace is intentionally strict:

- Only 2 people per room
- No TURN relay fallback for file data
- No server-side transfer fallback
- If a direct connection cannot be established, both sides need to switch networks and try again

That tradeoff keeps the product simple and keeps file contents off the server, but it also means some network combinations will fail.

## Architecture

```text
Browser A <- WebSocket signaling -> Rust backend <- WebSocket signaling -> Browser B
    |                                                                      |
    +------------------- WebRTC P2P data channel (chat + files) -----------+
```

**Tech Stack**

- Backend: Rust + Axum + Tokio + WebSocket
- Frontend: Vanilla JavaScript + WebRTC API + File System Access API
- Protocol: WebRTC DataChannel + custom message protocol

See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

## Security And Privacy

- File contents are transferred directly between the two browsers
- The server is used for signaling and room coordination only
- WebRTC uses DTLS/SRTP encrypted transport
- Anyone with the room code or share link can join the room, so treat them as sensitive
- Empty rooms expire after about 5 minutes

## Limitations

- Designed for exactly 2 participants
- Pure P2P means some NAT or enterprise network combinations may fail
- When direct connectivity fails, users must switch networks and retry
- Large file streaming depends on modern browser support

## Development

```bash
./dev.sh
make test
make build
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT License](LICENSE)

## Contributing

Issues and Pull Requests are welcome.

## Links

- Demo: https://0trace.org
- GitHub: https://github.com/momo2029/0trace
- Issues: https://github.com/momo2029/0trace/issues
