# 0trace

> 2人向けの純粋なP2Pブラウザーチャットとファイル転送

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[English](README.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

## Features

- サーバー中継なしの純粋な WebRTC P2P 転送
- チャットとファイル転送を1つのセッションに統合
- アカウント登録不要、インストール不要、ブラウザですぐ使える
- ルームコードまたは共有リンクで参加できる2人用フロー
- `BOOK23` のような覚えやすい6文字ルームコード
- URL に `?code=ROOMCODE` を保持するので、リロード後も同じ部屋を復元しやすい
- モダンブラウザで大容量ファイルのストリーミング転送に対応
- 中国語、英語、日本語、韓国語、スペイン語、フランス語のUIを提供

## Quick Start

### Online

[0trace.org](https://0trace.org) にアクセスしてください。

### Local Deployment

**Method 1: Docker**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

その後 `http://localhost:2029` を開きます。

**Method 2: Build from Source**

```bash
git clone https://github.com/momo2029/0trace
cd 0trace
./dev.sh
```

## How It Works

1. 一方がルームを作成します。
2. 0trace が6文字のルームコードと共有リンクを生成します。
3. もう一方がリンクを開くか、ルームコードを入力して参加します。
4. 2つのブラウザが WebRTC の直接接続を確立します。
5. チャットメッセージとファイルが同じ会話タイムラインに表示されます。

ページを更新しても、URL の `?code=` によって同じブラウザから部屋の復元を試せます。両者が退出して部屋が空のままだと、約5分で自動失効します。

## Product Positioning

0trace は意図的に厳格な設計です。

- 1ルームは2人まで
- ファイルデータ用の TURN リレーは使わない
- サーバー側の転送フォールバックは用意しない
- 直接接続できない場合は、双方がネットワークを切り替えて再試行する

この設計により、仕組みを単純に保ち、ファイル内容をサーバーに残しません。その代わり、ネットワークの組み合わせによっては接続できないことがあります。

## Architecture

```text
ブラウザA <- WebSocketシグナリング -> Rustバックエンド <- WebSocketシグナリング -> ブラウザB
    |                                                                           |
    +---------------- WebRTC P2P データチャネル（チャット + ファイル） ---------+
```

**Tech Stack**

- Backend: Rust + Axum + Tokio + WebSocket
- Frontend: Vanilla JavaScript + WebRTC API + File System Access API
- Protocol: WebRTC DataChannel + custom message protocol

詳細は [ARCHITECTURE.md](ARCHITECTURE.md) を参照してください。

## Security And Privacy

- ファイル内容は2つのブラウザ間で直接転送される
- サーバーはシグナリングとルーム管理のみに使用される
- WebRTC は DTLS/SRTP で暗号化される
- ルームコードまたは共有リンクを知っている人は参加できるため、機密情報として扱う必要がある
- 空のルームは約5分で自動失効する

## Limitations

- 参加者は2人に限定
- 純粋なP2Pのため、一部の NAT や企業ネットワークでは接続に失敗する
- 直接接続に失敗した場合は、ネットワークを切り替えて再試行する必要がある
- 大容量ファイルのストリーミングはモダンブラウザ依存

## Development

```bash
./dev.sh
make test
make build
```

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## License

[MIT License](LICENSE)

## Contributing

Issue と Pull Request を歓迎します。

## Links

- Demo: https://0trace.org
- GitHub: https://github.com/momo2029/0trace
- Issues: https://github.com/momo2029/0trace/issues
