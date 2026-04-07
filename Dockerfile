FROM rust:1.75-slim as builder

WORKDIR /app

COPY shared shared
COPY backend backend
COPY frontend frontend

RUN cargo build --release --manifest-path backend/Cargo.toml

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/backend/target/release/backend /app/backend
COPY --from=builder /app/frontend/static /app/frontend/static

EXPOSE 2029

CMD ["/app/backend"]
