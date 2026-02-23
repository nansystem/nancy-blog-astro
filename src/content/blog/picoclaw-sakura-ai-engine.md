---
title: "OpenClawに乗り遅れたら超軽量版PicoClawが出てた"
description: "PicoClaw（OpenClawのGo実装・超軽量AIエージェント）を、LLMにさくらのAI Engineを使って動かす設定手順と、api_baseのフルパス指定やモデル名プレフィックスなど実際にハマったポイントを記録する。"
date: 2026-02-17T12:00:00+09:00
categories:
  - AI
permalink: /PicoClaw-sakura-ai-engine
published: true
---

OpenClawが話題になっていたのは知っていたが、試すタイミングを逃しているうちに超軽量版のPicoClawがリリースされていた。出遅れたおかげで、より手軽に試せるものに出会えたのでよしとしよう。

## この記事で分かること

PicoClawをさくらのAI Engineで動かす設定手順と、Discord Bot連携までの流れを書く。

## PicoClawとは

OpenClawの軽量版。Goで書かれており、普通のLinuxマシンやDocker上でも問題なく動く。自分はWSLで動かした。2月9日にリリースされ、2月17日時点で14,000スターを超えている。

外部のLLMプロバイダにAPI接続して動く仕組みなので、さくらのAI EngineのようなOpenAI互換APIと組み合わせて使える。

## 前提環境

PicoClawはファイル読み書きやシェルコマンド実行のツールを内蔵している。`restrict_to_workspace: true` で読み書き先を制限できるが、あくまでLLM向けのガードレール。バイナリを直接動かす方法もあるが、Docker Composeならコンテナ自体がOSレベルで隔離してくれるので、こちらを選んだ。

- Docker / Docker Compose が使える環境
- さくらのAI Engineのアカウント（基盤モデル無償プランでOK）
- さくらのAI EngineのAPIトークン（コントロールパネルから発行）

## セットアップ手順

### 1. PicoClawのクローンと設定ファイルの準備

```bash
git clone https://github.com/sipeed/picoclaw.git
cd picoclaw
cp config/config.example.json config/config.json
```

### 2. config.jsonの編集

変更するのは2箇所だけ。

**①モデル名の変更（agents.defaults.model）**

デフォルトは `glm-4.7`（Zhipuのモデル）になっている。さくらのAI Engineのモデルに変更する。

```json
"agents": {
    "defaults": {
      "model": "gpt-oss-120b",
```

**②vLLMプロバイダにさくらのAPIキーとエンドポイントを設定**

```json
"vllm": {
    "api_key": "あなたのさくらAIトークン",
    "api_base": "https://api.ai.sakura.ad.jp/v1/"
}
```

### 3. 起動と動作確認

```bash
docker compose run --rm picoclaw-agent -m "こんにちは"
```

以下のように返ってくれば成功。

```text
🦞 こんにちは！今日はどのようなお手伝いをしましょうか？
```

## ハマったポイント2つ

### ハマり①：api_baseにフルパスを入れて404

```json
// NG: フルパスだと404
"api_base": "https://api.ai.sakura.ad.jp/v1/chat/completions"

// OK
"api_base": "https://api.ai.sakura.ad.jp/v1/"
```

PicoClawが内部で /chat/completions を勝手に足すので、フルパスを書くとパスが二重になって404。さくらのコンパネに表示されるエンドポイントをそのまま貼ると踏む。

**エラーメッセージ:**

```text
Status: 404
Body:   404 page not found
```

### ハマり②：デフォルトのモデル名 glm-4.7 を変更し忘れ

これは単純な見落とし。`config.example.json` のデフォルトモデルはZhipuの `glm-4.7` なので、さくらのAI Engineには存在しない。変更し忘れると400エラーになる。

## 切り分けに使ったcurlコマンド

PicoClawが動かないとき、API側の問題かPicoClaw側の問題かを切り分けるには、curlで直接叩くのが早い。

```bash
curl -X POST https://api.ai.sakura.ad.jp/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer あなたのAPIトークン" \
  -d '{"model": "gpt-oss-120b", "messages": [{"role": "user", "content": "hello"}]}'
```

これでレスポンスが返ればAPI側は正常。PicoClawの設定を疑える。

## PicoClawの3つの会話方法

動作確認ができたら、用途に応じて会話方法を選べる。

### ①インタラクティブモード（一番手軽）

`-m` を外して起動するだけ。チャットのように対話が続けられる。

```bash
docker compose run --rm picoclaw-agent
```

実際に動かすとこうなる。

```text
🦞 Interactive mode (Ctrl+C to exit)

🦞 You: こんにちは！

🦞 こんにちは！今日はどんなことをお手伝いできますか？気になることややりたいことがあれば、遠慮なく教えてくださいね。

🦞 You: picoclawは何ができる?

🦞 ## picoclaw ができること

| カテゴリ | 主な機能 | 具体例 |
|----------|----------|--------|
| **情報取得** | Web検索・ページ取得 | 最新ニュース、天気、製品情報、プログラミングドキュメントなどをリアルタイムで取得 |
| **ファイル操作** | 読み取り・書き込み・編集 | メモ保存、設定ファイルの更新、ログの追記など |
| **システム操作** | シェルコマンド実行 | ファイル一覧、プロセス確認、簡単なスクリプト実行 |
| **ハードウェア制御** | I2C / SPI デバイス操作（Sipeed 系ボード） | センサ読み取り、LED 制御、マイコンとの通信 |
| **マルチチャネル通知** | Telegram・WhatsApp・Feishu などへメッセージ送信 | リマインダー、結果報告、アラート送信 |
| **スキル拡張** | カスタムスキル (GitHub 操作、要約、tmux 制御、天気取得 など) | `github` スキルで Issue 作成、`summarize` で長文要約、`weather` で天気取得 |
| **記憶・学習** | 永続メモリ (`MEMORY.md`) に重要情報を保存 | ユーザーの好みや過去の指示を次回以降も利用 |
| **バックグラウンドタスク** | `subagent` / `spawn` で長時間処理を非同期実行 | 大規模検索や複数ステップのワークフローをバックグラウンドで実行する |
```

Markdownテーブルで整理された回答が返ってきた。

### ②Gatewayモード + チャットアプリ連携

Discord、LINE、Slackなどと連携できる。プライベートのアカウントにAIエージェントを繋ぐのはまだ怖いので、Discordでテスト用サーバーを立てて試した。なお、DiscordのBot設定はちょっと面倒だった。Gatewayモードを試したいだけなら、他のアプリを選ぶほうが手軽だ。

#### テスト用Discordサーバーの作成

Botの招待先が必要なので、先にサーバーを作っておく。

1. https://discord.com/channels/@me でログイン
2. 左サイドバーの一番下にある「+」ボタンをクリック
3. 「オリジナルの作成」→「自分と友達のため」を選択
4. サーバー名を適当につける（例：PicoClaw-test）

#### Discord Botの作成とToken取得

1. https://discord.com/developers/applications を開く
2. 右上の「New Application」をクリック、Nameに `picoclaw-test` を入力してCreate
3. 左メニューの「Bot」に進む
4. 「Reset Token」をクリック → 確認ダイアログで「Yes, do it」
5. 表示されたBot Tokenをコピーして控える（一度しか表示されない）
6. 下にスクロールして **Message Content Intent** をONにする
7. ページ下部の「Save Changes」を押す

#### BotをDiscordサーバーに招待

OAuth2 URL Generatorの「Generated URL」は、Redirect URLを設定しないと表示されない。表示されない場合は先にRedirectを設定してから再度確認するか、以下のURLを直接ブラウザで開く。`YOUR_CLIENT_ID` はOAuth2ページに表示されているClient IDに置き換える。

```text
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=67584&scope=bot
```

Discordでは各権限にビット値が割り当てられており、複数権限はそれらを足した数で指定する（[Permissions \| Discord Developer Portal](https://discord.com/developers/docs/topics/permissions)）。`permissions=67584` は Send Messages（2048）と Read Message History（65536）の合計だ。ボットがチャンネルのメッセージを読んで返信するために必要な最小限の権限になる。

「サーバーに追加」で先ほど作成したテスト用サーバーを選択して「はい」で招待完了。

#### PicoClawのconfig.jsonにDiscord設定を追加

```json
"channels": {
    "discord": {
      "enabled": true,
      "token": "BotページでReset Tokenして取得したトークン",
      "allow_from": []
    }
}
```

#### Gatewayモードで起動

```bash
docker compose --profile gateway up -d
```

ログを確認する。

```bash
docker compose logs -f picoclaw-gateway
```

ここで `⚠ Warning: No channels enabled` と表示された場合、config.jsonの変更がコンテナに反映されていない。一度落としてから再起動する。

```bash
docker compose --profile gateway down && docker compose --profile gateway up -d
```

正しく起動できると、ログに `Discord bot connected` と `Channels enabled: [discord]` が表示される。

```text
✓ Channels enabled: [discord]
✓ Gateway started on 0.0.0.0:18790
[INFO] discord: Discord bot connected {username=picoclaw-test}
```

Discordサーバーで `@picoclaw-test こんにちは` とメンションすると、Botが応答する。

使い終わったら停止を忘れずに。

```bash
docker compose --profile gateway down
```

### HEARTBEATが勝手に動く問題

`config.json` でHEARTBEATがデフォルト有効になっている。

```json
"heartbeat": {
    "enabled": true,
    "interval": 30
}
```

これは30分ごとにworkspace内の `HEARTBEAT.md` を読んでタスクを自動実行する機能。今は `HEARTBEAT.md` がないので何も起きないが、Gatewayモードで起動すると常駐してこの周期で動く。

`docker compose run --rm picoclaw-agent -m "こんにちは"` の場合は、1回応答して終了するので勝手に動き続けることはない。

## 動作確認後のconfig.json

さくらのAI Engine＋Discord連携までやった場合の、変更した箇所の抜粋。

```json
{
  "agents": {
    "defaults": {
      "model": "gpt-oss-120b",
      "max_tokens": 8192,
      "temperature": 0.7
    }
  },
  "providers": {
    "vllm": {
      "api_key": "あなたのさくらAIトークン",
      "api_base": "https://api.ai.sakura.ad.jp/v1/"
    }
  },
  "channels": {
    "discord": {
      "enabled": true,
      "token": "Botのトークン",
      "allow_from": []
    }
  }
}
```

他のプロバイダはデフォルトのままで問題ない。利用可能なモデルと料金はさくらのAI Engineのコントロールパネルで確認できる。

ここまでだとClaudeやOpenAIと変わらないので、遊んでみる。

## 参考

- [PicoClaw - GitHub](https://github.com/sipeed/picoclaw)
- [OpenClaw+さくらのAI Engine無料枠でAIエージェントを構築する](https://zenn.dev/yskst/articles/3309f73a813d1a)
