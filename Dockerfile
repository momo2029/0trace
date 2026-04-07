FROM rust:1.75-slim as builder

WORKDIR /app

# 复制依赖文件
COPY shared/Cargo.toml shared/Cargo.toml
COPY backend/Cargo.toml backend/Cargo.toml

# 创建虚拟源文件以缓存依赖
RUN mkdir -p shared/src backend/src && \
    echo "fn main() {}" > backend/src/main.rs && \
    echo "pub fn dummy() {}" > shared/src/lib.rs

# 构建依赖
RUN cargo build --release --manifest-path backend/Cargo.toml

# 复制实际源代码
COPY shared/src shared/src
COPY backend/src backend/src
COPY frontend/static backend/static

# 构建应用
RUN touch backend/src/main.rs && \
    cargo build --release --manifest-path backend/Cargo.toml

# 运行阶段
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/backend/target/release/backend /app/backend
COPY --from=builder /app/backend/static /app/static

EXPOSE 3000

CMD ["/app/backend"]
