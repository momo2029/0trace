# 0trace

> ゼロプライバシー P2P ファイル転送ツール - WebRTC ベースのピアツーピアファイル共有

[![Demo](https://img.shields.io/badge/demo-0trace.org-blue)](https://0trace.org)
[![GitHub](https://img.shields.io/badge/github-momo2029/0trace-green)](https://github.com/momo2029/0trace)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

[English](README.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md)

## ✨ 特徴

- 🔒 **ゼロプライバシー** - WebRTC P2P 直接転送、サーバーはデータを保存しない
- 🚀 **超軽量** - Rust バックエンド < 5MB、フロントエンドは Pure JavaScript、フレームワーク不要
- 📦 **即利用可能** - ブラウザで開くだけ、登録・インストール不要
- 🌐 **クロスネットワーク** - NAT トラバーサル対応、LAN に限定されない
- 🌍 **多言語対応** - 中国語、英語、日本語、韓国語、スペイン語、フランス語
- ⚡ **リアルタイム進捗** - 256KB チャンク転送、リアルタイム進捗表示

## 🚀 クイックスタート

### オンライン利用

[0trace.org](https://0trace.org) にアクセスしてすぐにファイル転送を開始

### ローカルデプロイ

**方法1: Docker（推奨）**

```bash
docker run -d -p 2029:2029 ghcr.io/momo2029/0trace:latest
```

http://localhost:2029 にアクセス

**方法2: ソースからビルド**

```bash
# リポジトリをクローン
git clone https://github.com/momo2029/0trace
cd 0trace

# 実行（Rust 1.75+ が必要）
make dev
```

## 📖 使い方

### ファイルを送信

1. [0trace.org](https://0trace.org) を開く
2. 「ファイルを送信」タブを選択
3. ファイル/フォルダをクリックまたはドラッグ&ドロップ
4. 「リンクをコピー」をクリック
5. リンクを受信者に共有（WeChat/QQ/メールなど）

### ファイルを受信

**方法1: リンクをクリック（推奨）**
- 受信者が共有リンクをクリック
- 自動で受信開始、手動操作不要

**方法2: 手動入力**
- 「ファイルを受信」タブを選択
- 6桁のピックアップコードを入力
- 「部屋に参加」をクリック

## 🏗️ アーキテクチャ

```
送信者 ←── WebSocket シグナリング ──→ Rust バックエンド ←── WebSocket シグナリング ──→ 受信者
   │                                                                             │
   └─────────────────────── WebRTC P2P 直接転送（ファイルデータ） ──────────────┘
```

**技術スタック：**
- バックエンド: Rust + Axum + Tokio + WebSocket
- フロントエンド: Vanilla JavaScript + WebRTC API
- プロトコル: WebRTC DataChannel + カスタム転送プロトコル

詳細は [ARCHITECTURE.md](ARCHITECTURE.md) を参照

## 🔒 セキュリティ

- ✅ WebRTC は DTLS/SRTP 暗号を内蔵
- ✅ サーバーはゼロデータ保存（シグナリングのみ）
- ✅ ピックアップコード空間 34^6 ≈ 15億通り
- ✅ 部屋は1時間で自動期限切れ

## ⚠️ 制限事項

- 部屋あたり最大2人（1送信 + 1受信）
- ファイルサイズはブラウザメモリに制限される
- 対称 NAT には TURN サーバーが必要（デフォルトでは未設定）

## 🛠️ 開発

[CONTRIBUTING.md](CONTRIBUTING.md) を参照

```bash
# 開発モード（ホットリロード）
./dev.sh

# テスト実行
make test

# プロダクションビルド
make build
```

## 📝 ライセンス

[MIT License](LICENSE)

## 🙏 謝辞

## 🤝 コントリビュート

Issue と Pull Request を歓迎します！

PR を送信する前に、[コントリビューションガイド](CONTRIBUTING.md) をお読みください

## 📧 連絡先

- プロジェクトホームページ: https://github.com/momo2029/0trace
- デモサイト: https://0trace.org
- Issue トラッカー: https://github.com/momo2029/0trace/issues
