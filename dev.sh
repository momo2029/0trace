#!/bin/bash

# 0trace 热更新启动脚本

echo "🚀 启动 0trace 开发服务器（热更新模式）"
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
echo "🌐 服务地址：http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 使用 cargo-watch 监听文件变化并自动重启
exec cargo watch \
    -w backend/src \
    -w shared/src \
    -x "run --manifest-path backend/Cargo.toml"
