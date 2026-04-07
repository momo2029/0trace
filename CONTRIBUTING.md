# Contributing Guide

Thank you for your interest in 0trace! This document will help you get started with development.

## 🚀 Development Environment

### Prerequisites

- Rust 1.75+
- Cargo
- Git

### Clone Repository

```bash
git clone https://github.com/momo2029/0trace
cd 0trace
```

## 🛠️ Development Workflow

### Start Development Server

**Method 1: Hot-reload Mode (Recommended)**

```bash
./dev.sh
```

Features:
- ✅ Automatically watches for code changes
- ✅ Automatically recompiles
- ✅ Automatically restarts server

Watch scope:
- `backend/src/**/*.rs` - Backend code
- `shared/src/**/*.rs` - Shared library code

**Method 2: Normal Mode**

```bash
make dev
```

### Modify Code

**Backend Code**
1. Edit `backend/src/*.rs` or `shared/src/*.rs`
2. Hot-reload mode: auto-restart ✅
3. Normal mode: Ctrl+C to stop → `make dev` to restart

**Frontend Code**
1. Edit `frontend/static/*.{html,css,js}`
2. Copy to backend: `cp frontend/static/* backend/static/`
3. Refresh browser ✅

Shortcut commands:
```bash
# Update all frontend files
cp -r frontend/static/* backend/static/

# Or update individually
cp frontend/static/style.css backend/static/
cp frontend/static/app.js backend/static/
```

## 🧪 Testing

### Run Tests

```bash
make test
```

### Local File Transfer Test

1. Open two browser windows (or use incognito mode)
   ```
   Window 1: http://localhost:2029
   Window 2: http://localhost:2029
   ```

2. Window 1 (Sender):
   - Select "Send Files" tab
    - Choose test file (recommended < 10MB)
   - Copy share link

3. Window 2 (Receiver):
   - Paste link into address bar
   - Auto-start receiving

### Suggested Test Files

| File Type | Size | Purpose |
|-----------|------|---------|
| Text file | < 1MB | Quick test |
| Image | 1-10MB | Regular test |
| Video | 10-100MB | Performance test |

## 🐛 Debugging

### Enable Detailed Logs

```bash
RUST_LOG=debug ./dev.sh
```

Log levels:
- `error` - Errors only
- `warn` - Warnings and above
- `info` - Info and above (default)
- `debug` - Debug info
- `trace` - All info

### Browser Debugging

1. Open Developer Tools: F12
2. Console tab: View JS logs
3. Network tab: View requests
4. Application tab: View localStorage

## 📦 Building

### Development Build

```bash
cargo build
```

### Production Build

```bash
make build
# Binary: backend/target/release/backend
```

### Docker Build

```bash
docker build -t 0trace .
docker run -p 2029:2029 0trace
```

## 📝 Code Standards

### Rust Code

```bash
# Format
cargo fmt

# Lint
cargo clippy

# Fix warnings
cargo clippy --fix
```

### JavaScript Code

- Use ES6+ syntax
- Avoid frameworks (stay lightweight)
- Add necessary comments

### Commit Convention

Use semantic commit messages:

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Code formatting changes
refactor: Refactor code
test: Add tests
chore: Build/toolchain updates
```

Examples:
```bash
git commit -m "feat: Add multi-file transfer support"
git commit -m "fix: Fix memory overflow for large files"
git commit -m "docs: Update README deployment instructions"
```

## 🏗️ Project Structure

```
0trace/
├── shared/              # Shared library (protocol definitions)
│   ├── src/
│   │   ├── protocol.rs  # Signaling protocol
│   │   └── room.rs      # Room management
│   └── Cargo.toml
│
├── backend/             # Rust backend
│   ├── src/
│   │   ├── main.rs      # Server entry point
│   │   ├── room.rs      # Room manager
│   │   └── ws.rs        # WebSocket handling
│   └── static/          # Static files (production)
│
├── frontend/            # Frontend development
│   └── static/
│       ├── index.html   # Main page
│       ├── app.js       # WebRTC logic
│       ├── style.css    # Styles
│       ├── i18n.js      # Multilingual system
│       └── i18n/        # Translation files
│
├── Dockerfile
├── Makefile
└── README.md
```

## 🤝 Submitting Pull Requests

1. Fork the project
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m "feat: Add new feature"`
4. Push branch: `git push origin feature/amazing-feature`
5. Submit Pull Request

### PR Checklist

- [ ] Code formatted with `cargo fmt`
- [ ] Code passes `cargo clippy` checks
- [ ] Added necessary tests
- [ ] Updated relevant documentation
- [ ] Tested locally
- [ ] Commit messages follow convention

## 🔧 Common Issues

### Port Already in Use

```bash
# Find process using port
lsof -ti:2029

# Kill process
lsof -ti:2029 | xargs kill -9
```

### Hot-reload Not Working

```bash
# Install cargo-watch
cargo install cargo-watch

# Check version
cargo watch --version
```

### Frontend Changes Not Applied

```bash
# Confirm files copied
ls -la backend/static/

# Force refresh browser
Cmd+Shift+R (Mac)
Ctrl+Shift+R (Windows/Linux)
```

### Compilation Errors

```bash
# Clean build cache
make clean

# Update dependencies
cargo update

# Rebuild
make build
```

## 📚 Resources

- [Rust Official Documentation](https://doc.rust-lang.org/)
- [Axum Framework Documentation](https://docs.rs/axum/)
- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Project Architecture Documentation](ARCHITECTURE.md)

## 💡 Development Tips

1. **Small commits** - Each commit should do one thing
2. **Write comments** - Add comments for complex logic
3. **Test first** - Write tests before modifying features
4. **Keep it simple** - Avoid over-engineering
5. **Performance mindset** - Consider memory and performance impact

## 🎯 Optimization Ideas

Contributions welcome for:

**Short-term**
- [ ] Add transfer speed display
- [ ] Support resumable transfers
- [ ] Add file preview
- [ ] Optimize large file transfers

**Medium-term**
- [ ] Integrate TURN server
- [ ] Add file encryption option
- [ ] Support batch transfers
- [ ] Mobile optimization

**Long-term**
- [ ] Text message transfer
- [ ] QR code sharing
- [ ] Transfer history
- [ ] Custom STUN/TURN configuration

## 📧 Contact

Questions or suggestions?

- Open Issue: https://github.com/momo2029/0trace/issues
- Discussions: https://github.com/momo2029/0trace/discussions

Thank you for your contributions! 🎉
