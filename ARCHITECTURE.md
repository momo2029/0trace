# Architecture Documentation

This document details the technical architecture, design decisions, and implementation details of 0trace.

## 📐 Overall Architecture

### System Architecture Diagram

```
┌─────────────┐                                    ┌─────────────┐
│  Sender     │                                    │  Receiver   │
│  Browser    │                                    │  Browser    │
│             │                                    │             │
│  WebRTC     │                                    │  WebRTC     │
│  JavaScript │                                    │  JavaScript │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │ WebSocket Signaling                             │ WebSocket Signaling
       │ (SDP/ICE)                                       │ (SDP/ICE)
       │                                                  │
       └──────────────────┬──────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │ Rust      │
                    │ Backend   │
                    │           │
                    │ Axum      │
                    │ + Tokio   │
                    │ + WebSocket│
                    └───────────┘
                          │
                          │ Signaling relay
                          │ Room management
                          │
       ┌──────────────────┴──────────────────┐
       │                                     │
┌──────▼──────┐                      ┌──────▼──────┐
│  Sender     │                      │  Receiver   │
│  DataChannel│◄────P2P Direct─────►│  DataChannel│
│  (File Data)│    (DTLS encrypted) │  (File Data)│
└─────────────┘                      └─────────────┘
```

### Core Workflow

1. **Room Creation**: Sender creates a room, gets an 8-digit pickup code
2. **Signaling Exchange**: Both parties exchange SDP and ICE candidates via WebSocket
3. **P2P Connection**: WebRTC establishes peer-to-peer connection with multiple STUN servers
4. **File Transfer**: Transfer file data via DataChannel (streaming mode for large files)
5. **Auto Cleanup**: Room automatically expires after 5 minutes of inactivity
6. **Keep-Alive**: WebSocket heartbeat and auto-reconnect maintain connection stability

## 🏗️ Technology Stack

### Backend

| Component | Version | Purpose |
|-----------|---------|---------|
| Rust | 1.75+ | Systems programming language |
| Axum | 0.7 | Web framework |
| Tokio | 1.35 | Async runtime |
| Tower | 0.4 | Middleware |
| Serde | 1.0 | Serialization/deserialization |

### Frontend

| Component | Description |
|-----------|-------------|
| Vanilla JavaScript | No framework, stays lightweight |
| WebRTC API | Browser-native P2P |
| WebSocket API | Signaling communication |
| Fetch API | HTTP requests |

### Protocols

- **Signaling Protocol**: WebSocket + JSON
- **Transport Protocol**: WebRTC DataChannel
- **Encryption**: DTLS/SRTP (WebRTC built-in)

## 📁 Project Structure

```
0trace/
├── shared/                      # Shared library
│   ├── src/
│   │   ├── lib.rs               # Library entry point
│   │   ├── protocol.rs          # Protocol definitions
│   │   │   ├── SignalMessage    # Signaling messages
│   │   │   └── TransferMessage  # Transfer messages
│   │   └── room.rs              # Room logic
│   │       ├── RoomStatus       # Room status
│   │       └── generate_code()  # Pickup code generation
│   └── Cargo.toml
│
├── backend/                     # Backend service
│   ├── src/
│   │   ├── main.rs              # Server entry point
│   │   │   ├── HTTP routes
│   │   │   ├── Static file service
│   │   │   └── CORS configuration
│   │   ├── room.rs              # Room manager
│   │   │   ├── RoomManager      # Room management
│   │   │   ├── create_room()    # Create room
│   │   │   ├── join_room()      # Join room
│   │   │   └── cleanup_expired()# Cleanup expired rooms
│   │   └── ws.rs                # WebSocket handling
│   │       ├── handle_ws()      # Connection handling
│   │       └── forward_signal() # Signaling relay
│   ├── static/                  # Static files (production)
│   └── Cargo.toml
│
└── frontend/                    # Frontend development
    └── static/
        ├── index.html           # Main page
        ├── app.js               # Core logic
        │   ├── WebRTCConnection # WebRTC management
        │   └── App              # UI control
        ├── style.css            # Styles
        ├── i18n.js              # Multilingual system
        └── i18n/                # Translation files
            ├── zh-CN.json
            ├── en.json
            ├── ja.json
            ├── ko.json
            ├── es.json
            └── fr.json
```

## 🔌 API Design

### HTTP API

**Create Room**
```http
POST /api/create-room
Response: {"success": true, "code": "ABC123"}
```

**Query Room**
```http
GET /api/room-info?code=ABC123
Response: {"exists": true, "sender_connected": true, "receiver_connected": false}
```

### WebSocket API

**Connection**
```
ws://localhost:2029/api/ws?code=ABC123&role=sender
```

**Signaling Messages**
```json
// Offer
{"type": "offer", "sdp": "..."}

// Answer
{"type": "answer", "sdp": "..."}

// ICE Candidate
{"type": "ice-candidate", "candidate": "..."}

// Peer joined
{"type": "peer-joined", "role": "receiver"}

// Peer left
{"type": "peer-left"}

// Error
{"type": "error", "message": "..."}
```

## 🔐 Security Design

### Transport Security

1. **WebRTC Encryption**
   - DTLS (Datagram Transport Layer Security)
   - SRTP (Secure Real-time Transport Protocol)
   - End-to-end encryption, server cannot decrypt

2. **Signaling Security**
   - WebSocket connection (WSS in production)
   - Pickup code verification
   - Room capacity limit (max 2 people)

3. **Data Privacy**
   - Zero server storage
   - Only forwards signaling messages
   - No file content logging

### Room Security

**Pickup Code Design**
```rust
const CHARS: &[u8] = b"123456789ABCDEFGHIJKLMNPQRSTUVWXYZ";
// Excludes 0 and O to avoid confusion
// 34^6 ≈ 1.5 billion combinations
```

**Expiration Mechanism**
- Creation timestamp recorded
- Auto-cleanup after 1 hour
- Periodic scan for expired rooms

## 📡 Transfer Protocol

### File Transfer Flow

```
1. Sender → Receiver: File metadata
   {"type": "file-meta", "name": "test.jpg", "size": 1024000, "mimeType": "image/jpeg"}

2. Sender → Receiver: Chunk info + data
   {"type": "chunk-info", "index": 0, "total": 4}
   [ArrayBuffer: 256KB data]

3. Repeat step 2 until all chunks transferred

4. Sender → Receiver: Transfer complete
   {"type": "complete"}

5. Receiver: Assemble file and trigger download
```

### Chunking Strategy

```javascript
const CHUNK_SIZE = 256 * 1024; // 256KB

// Advantages:
// - Reduces memory footprint
// - Real-time progress updates
// - Supports large files
// - Lowers transfer failure risk
```

## 🎨 Frontend Design

### WebRTC Connection Management

```javascript
class WebRTCConnection {
    constructor() {
        this.pc = null;           // RTCPeerConnection
        this.dc = null;           // RTCDataChannel
        this.ws = null;           // WebSocket
        this.role = null;         // 'sender' | 'receiver'
    }

    // Core methods
    async createRoom()            // Create room
    async joinRoom(code)          // Join room
    setupPeerConnection()         // Setup PeerConnection
    setupDataChannel()            // Setup DataChannel
    async sendFile(file)          // Send file
    handleFileReceive()           // Receive file
}
```

### UI Control

```javascript
class App {
    constructor() {
        this.connection = null;
        this.selectedFiles = null;
    }

    // Core methods
    async init()                  // Initialize (i18n + events)
    initModals()                  // Initialize modals
    handleFilesSelect(files)      // Handle file selection
    async sendFiles()             // Send multiple files
    async joinRoom(code)          // Join room
    showToast(message, type)      // Show notification
}
```

### Multilingual System

```javascript
class I18n {
    async init()                  // Initialize (auto-detect language)
    async loadLanguage(lang)      // Load translation file
    t(key)                        // Translation function
    updateUI()                    // Update UI text
}

// Usage
i18n.t('send.copyLink')          // → "Copy Link"
```

## 🔄 State Management

### Room State

```rust
pub struct Room {
    pub code: String,
    pub created_at: Instant,
    pub sender: Option<SplitSink<WebSocket, Message>>,
    pub receiver: Option<SplitSink<WebSocket, Message>>,
}

pub enum RoomStatus {
    WaitingSender,
    WaitingReceiver,
    Connected,
    Expired,
}
```

### Connection State

```javascript
// WebRTC connection state
'new' → 'connecting' → 'connected' → 'disconnected' | 'failed'

// DataChannel state
'connecting' → 'open' → 'closing' → 'closed'
```

## ⚡ Performance Optimization

### Backend Optimization

1. **Async I/O**
   - Tokio async runtime
   - Non-blocking WebSocket
   - High concurrency support

2. **Memory Management**
   - RwLock read-write lock
   - Periodic cleanup of expired rooms
   - Zero-copy message forwarding

3. **Compile Optimization**
   ```toml
   [profile.release]
   opt-level = 3
   lto = true
   codegen-units = 1
   ```

### Frontend Optimization

1. **Chunked Transfer**
   - 256KB chunk size
   - Avoids memory overflow
   - Real-time progress updates

2. **Resource Optimization**
   - No framework dependencies
   - Compressed icon resources
   - CSS variable reuse

3. **User Experience**
   - Toast instead of alert
   - Smooth animations
   - Responsive design

## 🐛 Known Issues and Solutions

### 1. Connection Timing Issue

**Problem**: Sender creates offer too early, receiver not ready

**Solution**:
```javascript
// Sender waits for peer-joined message
case 'peer-joined':
    if (this.role === 'sender') {
        this.createOffer();
    }
    break;
```

### 2. Room Premature Deletion

**Problem**: One party leaving causes room deletion, other cannot join

**Solution**:
```rust
// Remove is_empty() check, rely only on 1-hour expiration
pub async fn leave_room(&self, code: &str, role: Role) {
    let mut rooms = self.rooms.write().await;
    if let Some(room) = rooms.get_mut(code) {
        room.remove_client(role);
        // Do not delete room immediately
    }
}
```

### 3. NAT Traversal

**Problem**: Symmetric NAT cannot establish P2P connection

**Solution**:
- Short-term: Use STUN server (already configured)
- Long-term: Integrate TURN server (relay)

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| Backend binary size | < 5MB (release) |
| Frontend asset size | < 100KB (including icons) |
| Memory usage | < 10MB (idle) |
| Startup time | < 10ms |
| Concurrent rooms | 1000+ (depends on memory) |
| Transfer speed | 10-50 MB/s (LAN) |

## 🔮 Future Optimizations

### Short-term (1-3 months)

- [ ] Add transfer speed display
- [ ] Support resumable transfers
- [ ] Add file preview
- [ ] Optimize large file transfers (streaming)

### Medium-term (3-6 months)

- [ ] Integrate TURN server
- [ ] Add file encryption option
- [ ] Support batch transfer queue
- [ ] Mobile PWA optimization

### Long-term (6-12 months)

- [ ] Text message transfer
- [ ] QR code sharing
- [ ] Transfer history (optional)
- [ ] Custom STUN/TURN configuration

## 📚 References

- [WebRTC Specification](https://www.w3.org/TR/webrtc/)
- [Axum Documentation](https://docs.rs/axum/)
- [Tokio Documentation](https://tokio.rs/)
- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)

## 🤝 Design Principles

1. **Simplicity over complexity** - Avoid over-engineering
2. **Performance over features** - Keep it lightweight and efficient
3. **Security over convenience** - Privacy first
4. **User experience over technical flair** - Practicality-focused

---

Last updated: 2026-04-07
