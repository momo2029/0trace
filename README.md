# 0trace

> 零隐私 P2P 文件传输工具 - 基于 WebRTC 点对点技术

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[English](README_EN.md) | 简体中文

## ✨ 特性

- 🔒 **零隐私** - 文件通过 WebRTC P2P 直传，服务器不存储任何数据
- 🚀 **极致轻量** - Rust 后端 < 5MB，前端纯 JavaScript 无框架
- 📦 **开箱即用** - 浏览器打开即用，无需注册或安装
- 🌐 **跨网络传输** - 支持 NAT 穿透，不限局域网
- 🌍 **多语言支持** - 中文、英语、日语、韩语、西班牙语、法语
- ⚡ **实时进度** - 256KB 分块传输，实时显示进度

## 🚀 快速开始

### 在线使用

访问 [0trace.org](https://0trace.org) 立即开始传输文件

### 本地部署

**方式一：Docker（推荐）**

```bash
docker run -d -p 3000:3000 momo2029/0trace
```

访问 http://localhost:3000

**方式二：从源码编译**

```bash
# 克隆项目
git clone https://github.com/momo2029/0trace
cd 0trace

# 运行（需要 Rust 1.75+）
make dev
```

## 📖 使用方法

### 发送文件

1. 打开 [0trace.org](https://0trace.org)
2. 选择「发送文件」标签
3. 点击或拖拽文件/文件夹
4. 点击「复制链接」
5. 将链接发送给接收方（微信/QQ/邮件等）

### 接收文件

**方式一：点击链接（推荐）**
- 接收方点击分享链接
- 自动开始接收，无需任何操作

**方式二：手动输入**
- 选择「接收文件」标签
- 输入 6 位取件码
- 点击「加入房间」

## 🏗️ 技术架构

```
发送方 ←── WebSocket 信令 ──→ Rust 后端 ←── WebSocket 信令 ──→ 接收方
   │                                                              │
   └──────────────── WebRTC P2P 直连（文件数据） ──────────────────┘
```

**技术栈：**
- 后端：Rust + Axum + Tokio + WebSocket
- 前端：原生 JavaScript + WebRTC API
- 协议：WebRTC DataChannel + 自定义传输协议

详见 [ARCHITECTURE.md](ARCHITECTURE.md)

## 🔒 安全性

- ✅ WebRTC 自带 DTLS/SRTP 加密
- ✅ 服务器零数据留存（仅转发信令）
- ✅ 取件码空间 34^6 ≈ 15 亿
- ✅ 房间 1 小时自动过期

## ⚠️ 限制

- 房间最多 2 人（1 发送 + 1 接收）
- 文件大小受限于浏览器内存
- 对称 NAT 需要 TURN 服务器（默认未配置）

## 🛠️ 开发

详见 [CONTRIBUTING.md](CONTRIBUTING.md)

```bash
# 开发模式（热更新）
./dev.sh

# 运行测试
make test

# 构建生产版本
make build
```

## 📝 许可证

[MIT License](LICENSE)

## 🙏 致谢


## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

在提交 PR 前，请阅读 [贡献指南](CONTRIBUTING.md)

## 📧 联系

- 项目主页：https://github.com/momo2029/0trace
- 演示站点：https://0trace.org
- 问题反馈：https://github.com/momo2029/0trace/issues
