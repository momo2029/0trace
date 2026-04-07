#!/bin/bash

# 0trace 热更新启动脚本

# 找到项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "🚀 启动 0trace 开发服务器（热更新模式）"
echo "📂 项目目录：$SCRIPT_DIR"
echo ""

# 检查 cargo-watch 是否安装
if ! command -v cargo-watch &> /dev/null; then
    echo "📦 安装 cargo-watch..."
    cargo install cargo-watch
    echo ""
fi

# 启动热更新服务
echo "🔥 启动热更新服务..."
echo "📝 监听文件变化：backend/src/**/*.rs, shared/src/**/*.rs"
echo "🌐 服务地址：http://localhost:2029"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 切换到 backend 目录运行
cd backend || exit 1

# 使用 cargo-watch 监听文件变化并自动重启
exec cargo watch \
    -w src \
    -w ../shared/src \
    -x run
