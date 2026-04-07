# Deployment Guide

This document explains how to deploy 0trace to a server.

## 🚀 Quick Deployment

### Method 1: Use GHCR Image (Easiest)

Pull and run directly from GitHub Container Registry:

```bash
# Pull and run
docker run -d \
  --name 0trace \
  --restart unless-stopped \
  -p 2029:2029 \
  -e TZ=Asia/Shanghai \
  ghcr.io/momo2029/0trace:latest

# View logs
docker logs -f 0trace
```

Access: http://localhost:2029

### Method 2: Docker Compose Deployment (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/momo2029/0trace
cd 0trace

# 2. Start
docker-compose up -d

# 3. View logs
docker-compose logs -f
```

### Method 3: Build Image Locally

```bash
# 1. Clone repository
git clone https://github.com/momo2029/0trace
cd 0trace

# 2. Build image
docker build -t 0trace .

# 3. Run container
docker run -d \
  --name 0trace \
  --restart unless-stopped \
  -p 2029:2029 \
  0trace

# 4. View logs
docker logs -f 0trace
```

### Method 2: Compile Directly

```bash
# 1. Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Clone repository
git clone https://github.com/momo2029/0trace
cd 0trace

# 3. Build
make build

# 4. Run
./backend/target/release/backend
```

### Method 3: Use systemd Service

```bash
# 1. Build project
cd /opt/0trace
make build

# 2. Create systemd service
sudo vim /etc/systemd/system/0trace.service
```

```ini
[Unit]
Description=0trace P2P File Transfer
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/0trace
ExecStart=/opt/0trace/backend/target/release/backend
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# 3. Start service
sudo systemctl daemon-reload
sudo systemctl enable 0trace
sudo systemctl start 0trace

# 4. Check status
sudo systemctl status 0trace
```

## 🔄 Update Deployment

### Docker Method

```bash
cd /opt/0trace

# 1. Pull latest code
git pull

# 2. Rebuild image
docker build -t 0trace .

# 3. Stop and remove old container
docker stop 0trace
docker rm 0trace

# 4. Start new container
docker run -d \
  --name 0trace \
  --restart unless-stopped \
  -p 2029:2029 \
  0trace

# 5. Clean old images
docker image prune -f
```

### Direct Compile Method

```bash
cd /opt/0trace

# 1. Pull latest code
git pull

# 2. Rebuild
make build

# 3. Restart service
sudo systemctl restart 0trace
```

## 🌐 Reverse Proxy Configuration

### Nginx Configuration

```bash
# Create config file
sudo vim /etc/nginx/sites-available/0trace
```

```nginx
server {
    listen 80;
    server_name 0trace.org;

    # WebSocket support
    location / {
        proxy_pass http://localhost:2029;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings (support long transfers)
        proxy_read_timeout 7200s;
        proxy_send_timeout 7200s;
    }
}
```

```bash
# Enable config
sudo ln -s /etc/nginx/sites-available/0trace /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Configure HTTPS (Let's Encrypt)

```bash
# 1. Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 2. Obtain certificate
sudo certbot --nginx -d 0trace.org

# 3. Test auto-renewal
sudo certbot renew --dry-run
```

Certbot will automatically modify Nginx config to add SSL certificate.

## 🔧 Environment Configuration

### Change Port

**Docker:**
```bash
docker run -d \
  --name 0trace \
  --restart unless-stopped \
  -p 8080:2029 \  # Change to 8080
  0trace
```

**Direct Compile:**
```bash
# Modify backend/src/main.rs
# Or use environment variable (if supported)
PORT=8080 ./backend/target/release/backend
```

### Log Level

```bash
# Docker
docker run -d \
  --name 0trace \
  --restart unless-stopped \
  -p 2029:2029 \
  -e RUST_LOG=debug \
  0trace

# Direct run
RUST_LOG=debug ./backend/target/release/backend
```

Log levels:
- `error` - Errors only
- `warn` - Warnings and above
- `info` - Info and above (default)
- `debug` - Debug info
- `trace` - All info

## 📊 Monitoring and Maintenance

### View Logs

**Docker:**
```bash
# Real-time logs
docker logs -f 0trace

# Last 100 lines
docker logs --tail 100 0trace
```

**systemd:**
```bash
# Real-time logs
sudo journalctl -u 0trace -f

# Last 100 lines
sudo journalctl -u 0trace -n 100
```

### View Resource Usage

```bash
# Docker
docker stats 0trace

# System process
top -p $(pgrep backend)
```

### Restart Service

```bash
# Docker
docker restart 0trace

# systemd
sudo systemctl restart 0trace
```

## 🔒 Security Recommendations

### 1. Configure Firewall

```bash
# UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# If exposing port 2029 directly
sudo ufw allow 2029/tcp
```

### 2. Limit Access

Use Nginx rate limiting:

```nginx
# Add to http block
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Add to location block
limit_req zone=api burst=20 nodelay;
```

### 3. Regular Updates

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Update Docker
sudo apt install docker-ce docker-ce-cli containerd.io

# Update 0trace
cd /opt/0trace && git pull && make build
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using port
sudo lsof -i :2029

# Kill process
sudo kill -9 <PID>
```

### Container Fails to Start

```bash
# View detailed logs
docker logs 0trace

# Check container status
docker ps -a

# Rebuild
docker build --no-cache -t 0trace .
```

### Service Not Accessible

```bash
# Check service status
sudo systemctl status 0trace

# Check port listening
sudo netstat -tlnp | grep 2029

# Check firewall
sudo ufw status
```

### Nginx 502 Error

```bash
# Check if backend is running
curl http://localhost:2029

# Check Nginx config
sudo nginx -t

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## 📦 Docker Compose (Recommended)

Project already includes `docker-compose.yml` using GHCR pre-built image:

```yaml
services:
  0trace:
    image: ghcr.io/momo2029/0trace:latest
    container_name: 0trace
    restart: unless-stopped
    ports:
      - "2029:2029"
    environment:
      - TZ=Asia/Shanghai
      - RUST_LOG=info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:2029/"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - 0trace_network

networks:
  0trace_network:
    driver: bridge
```

Usage:

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Update to latest image
docker-compose pull
docker-compose up -d
```

To build image locally, change `image` to `build: .` in `docker-compose.yml`.

## 🎯 Performance Optimization

### 1. Compile Optimization

Already configured in `Cargo.toml`:

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
```

### 2. System Optimization

```bash
# Increase file descriptor limit
sudo vim /etc/security/limits.conf
```

```
* soft nofile 65535
* hard nofile 65535
```

### 3. Nginx Optimization

```nginx
# Worker processes
worker_processes auto;

# Connections
events {
    worker_connections 4096;
}

# Buffers
http {
    client_body_buffer_size 128k;
    client_max_body_size 10m;
}
```

## 📚 References

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [systemd Documentation](https://www.freedesktop.org/software/systemd/man/)

## 💡 Tips

- Use Docker for easier deployment and updates
- HTTPS is required in production
- Back up configuration files regularly
- Monitor server resource usage
- Set up log rotation to avoid disk full

---

Last updated: 2026-04-07
