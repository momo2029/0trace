.PHONY: dev build clean test

# 开发模式
dev:
	cargo run --manifest-path backend/Cargo.toml

# 编译后端
build:
	cargo build --release --manifest-path backend/Cargo.toml

# 清理
clean:
	cargo clean --manifest-path backend/Cargo.toml
	cargo clean --manifest-path shared/Cargo.toml

# 测试
test:
	cargo test --manifest-path shared/Cargo.toml
	cargo test --manifest-path backend/Cargo.toml

# 运行
run: build
	./backend/target/release/backend
