FROM rust:1.75-slim as builder

WORKDIR /app

# 复制所有源代码
COPY shared shared
COPY backend backend
COPY frontend/static backend/static

# 构建应用
RUN cargo build --release --manifest-path backend/Cargo.toml

# 运行阶段
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/backend/target/release/backend /app/backend
COPY --from=builder /app/backend/static /app/static

EXPOSE 2029

CMD ["/app/backend"]
