# 0trace

> 두 사람을 위한 순수 P2P 브라우저 채팅 및 파일 전송

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[English](README.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md)

## Features

- 서버 중계 없이 WebRTC로 직접 전송하는 순수 P2P 구조
- 채팅과 파일 전송을 하나의 세션에 통합
- 가입 없이, 설치 없이, 브라우저에서 바로 사용 가능
- 방 코드 또는 공유 링크로 참여하는 2인 전용 흐름
- `BOOK23` 같은 기억하기 쉬운 6자리 방 코드
- URL에 `?code=ROOMCODE` 가 남아 새로고침 후에도 같은 방 복원을 시도할 수 있음
- 최신 브라우저에서 대용량 파일 스트리밍 전송 지원
- 중국어, 영어, 일본어, 한국어, 스페인어, 프랑스어 UI 제공

## Quick Start

### Online

[0trace.org](https://0trace.org) 에 접속하세요.

### Local Deployment

**Method 1: Docker**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

그다음 `http://localhost:2029` 를 엽니다.

**Method 2: Build from Source**

```bash
git clone https://github.com/momo2029/0trace
cd 0trace
./dev.sh
```

## How It Works

1. 한쪽이 방을 생성합니다.
2. 0trace 가 6자리 방 코드와 공유 링크를 생성합니다.
3. 다른 한쪽이 링크를 열거나 방 코드를 입력해 참여합니다.
4. 두 브라우저가 WebRTC 직접 연결을 수립합니다.
5. 채팅 메시지와 파일이 같은 대화 타임라인에 표시됩니다.

페이지를 새로고침해도 URL의 `?code=` 를 통해 같은 브라우저에서 방 복원을 시도할 수 있습니다. 양쪽 모두 나가서 방이 비어 있으면 약 5분 후 자동 만료됩니다.

## Product Positioning

0trace 는 의도적으로 엄격한 제품입니다.

- 방당 참여자는 2명만 허용
- 파일 데이터용 TURN 릴레이를 사용하지 않음
- 서버 측 전송 폴백을 두지 않음
- 직접 연결이 안 되면 양쪽이 네트워크를 바꿔 다시 시도해야 함

이 선택으로 구조는 단순해지고 파일 내용은 서버에 남지 않습니다. 대신 네트워크 조합에 따라 연결이 실패할 수 있습니다.

## Architecture

```text
브라우저 A <- WebSocket 시그널링 -> Rust 백엔드 <- WebSocket 시그널링 -> 브라우저 B
    |                                                                      |
    +---------------- WebRTC P2P 데이터 채널 (채팅 + 파일) -----------------+
```

**Tech Stack**

- Backend: Rust + Axum + Tokio + WebSocket
- Frontend: Vanilla JavaScript + WebRTC API + File System Access API
- Protocol: WebRTC DataChannel + custom message protocol

자세한 내용은 [ARCHITECTURE.md](ARCHITECTURE.md) 를 참고하세요.

## Security And Privacy

- 파일 내용은 두 브라우저 사이에서 직접 전송됩니다
- 서버는 시그널링과 방 관리에만 사용됩니다
- WebRTC 는 DTLS/SRTP 로 암호화됩니다
- 방 코드나 공유 링크를 가진 사람은 입장할 수 있으므로 민감 정보로 다뤄야 합니다
- 비어 있는 방은 약 5분 후 자동 만료됩니다

## Limitations

- 정확히 2명만 지원
- 순수 P2P 이므로 일부 NAT 또는 기업망에서는 연결에 실패할 수 있음
- 직접 연결에 실패하면 네트워크를 바꿔 다시 시도해야 함
- 대용량 파일 스트리밍은 최신 브라우저 지원에 의존함

## Development

```bash
./dev.sh
make test
make build
```

[CONTRIBUTING.md](CONTRIBUTING.md) 를 참고하세요.

## License

[MIT License](LICENSE)

## Contributing

Issue 와 Pull Request 를 환영합니다.

## Links

- Demo: https://0trace.org
- GitHub: https://github.com/momo2029/0trace
- Issues: https://github.com/momo2029/0trace/issues
