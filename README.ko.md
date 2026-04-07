# 0trace

> 제로 프라이버시 P2P 파일 전송 도구 - WebRTC 기반 피어투피어 파일 공유

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[English](README.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md)

## ✨ 기능

- 🔒 **제로 프라이버시** - WebRTC P2P 직접 전송, 서버는 데이터 저장 안 함
- 🚀 **초경량** - Rust 백엔드 < 5MB, 프론트엔드는 순수 JavaScript, 프레임워크 불필요
- 📦 **즉시 사용 가능** - 브라우저에서 열기만 하면 됨, 가입/설치 필요 없음
- 🌐 **크로스 네트워크** - NAT 트래버설 지원, LAN 제한 없음
- 🌍 **다국어 지원** - 중국어, 영어, 일본어, 한국어, 스페인어, 프랑스어
- ⚡ **실시간 진행률** - 256KB 청크 전송, 실시간 진행률 표시

## 🚀 빠른 시작

### 온라인 사용

[0trace.org](https://0trace.org) 접속하여 즉시 파일 전송 시작

### 로컬 배포

**방법 1: Docker (권장)**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

http://localhost:2029 접속

**방법 2: 소스에서 빌드**

```bash
# 저장소 클론
git clone https://github.com/momo2029/0trace
cd 0trace

# 실행 (Rust 1.75+ 필요)
make dev
```

## 📖 사용 방법

### 파일 보내기

1. [0trace.org](https://0trace.org) 열기
2. 「파일 보내기」 탭 선택
3. 파일/폴더 클릭 또는 드래그&드롭
4. 「링크 복사」 클릭
5. 링크를 수신자와 공유 (WeChat/QQ/이메일 등)

### 파일 받기

**방법 1: 링크 클릭 (권장)**
- 수신자가 공유 링크 클릭
- 자동으로 수신 시작, 수동 조작 불필요

**방법 2: 수동 입력**
- 「파일 받기」 탭 선택
- 6자리 픽업 코드 입력
- 「방 참여」 클릭

## 🏗️ 아키텍처

```
발신자 ←── WebSocket 시그널링 ──→ Rust 백엔드 ←── WebSocket 시그널링 ──→ 수신자
   │                                                                             │
   └─────────────────────── WebRTC P2P 직접 전송 (파일 데이터) ──────────────┘
```

**기술 스택:**
- 백엔드: Rust + Axum + Tokio + WebSocket
- 프론트엔드: Vanilla JavaScript + WebRTC API
- 프로토콜: WebRTC DataChannel + 커스텀 전송 프로토콜

자세한 내용은 [ARCHITECTURE.md](ARCHITECTURE.md) 참조

## 🔒 보안

- ✅ WebRTC는 DTLS/SRTP 암호화 내장
- ✅ 서버 제로 데이터 보관 (시그널링 전용)
- ✅ 픽업 코드 공간 34^6 ≈ 15억 개
- ✅ 방은 1시간 후 자동 만료

## ⚠️ 제한사항

- 방당 최대 2명 (1발신 + 1수신)
- 파일 크기는 브라우저 메모리에 제한됨
- 대칭 NAT에는 TURN 서버 필요 (기본값 미설정)

## 🛠️ 개발

[CONTRIBUTING.md](CONTRIBUTING.md) 참조

```bash
# 개발 모드 (핫 리로드)
./dev.sh

# 테스트 실행
make test

# 프로덕션 빌드
make build
```

## 📝 라이선스

[MIT License](LICENSE)

## 🙏 감사의 글

## 🤝 기여

Issue와 Pull Request를 환영합니다!

PR을 보내기 전에 [기여 가이드](CONTRIBUTING.md)를 읽어주세요

## 📧 연락처

- 프로젝트 홈페이지: https://github.com/momo2029/0trace
- 데모 사이트: https://0trace.org
- 이슈 트래커: https://github.com/momo2029/0trace/issues
