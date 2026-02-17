# Session Context

## User Prompts

### Prompt 1

# PicoClawをさくらのAI Engineで動かすまでにハマった3つのこと

## この記事で分かること

PicoClaw（OpenClawのGo実装・超軽量AIエージェント）を、さくらのAI Engine経由で動かすための設定手順と、実際にハマったポイントを記録する。先行記事とは異なる挙動もあったので、2026年2月17日時点の一次情報として残しておく。

## PicoClawとは

SipeedがリリースしたOpenClawの軽量版。Goで�...

### Prompt 2

PicoClawには3つの会話方法があります。
① インタラクティブモード（一番手軽）
-m を外して起動するだけです。
bashdocker compose run --rm picoclaw-agent
これでチャットのように対話が続けられるはずです。
② Gatewayモード + チャットアプリ連携
Telegram、Discord、LINE、Slack等と連携して、チャットアプリ上で会話できます。例えばDiscordの場合：
json"channels": {
    "discord": {
      "enabled":...

### Prompt 3

dockerだから安全なの?勝手に動くと思ってたけど、Docker内なのでホストOSに直接影響はしにくいですが、PicoClawにはファイル読み書きやコマンド実行のツールが内蔵されています。restrict_to_workspace: true にしているのでworkspaceディレクトリ内に制限されますが、完全に安全というわけではありません。
勝手に動く件について
config.jsonでHEARTBEATが有効になっています。
json"heartbe...

### Prompt 4

gatewayモード試したかったのでdiscordにアカウント登録した。と思ったらアカウントあった。https://discord.com/developers/applications画面で右上の 「New Application」 をクリック　Nameにpicoclaw-testを入力してCreateボタンを押した

### Prompt 5

なんどもあなたは人間ですか、とポップアップが表示される

### Prompt 6

作成後、左メニューに「Bot」が出てくるのでそこに進みます。「Reset Token」をクリックしてBot Tokenを取得　Reset Bot's Token?

Your bot will stop working until you update the token in your bot's code.と表示されるので「Yes,do it!」ボタンを押す

### Prompt 7

Message Content IntentをONにして、ページ下部の Save Changes を押した

### Prompt 8

次はBotをテスト用サーバーに招待する。次は左メニューの 「OAuth2」 をクリック。OAuth2 URL Generatorがあるので、Scopesで bot にチェック。Bot PermissionsでSend MessagesとRead Message Historyにチェックする。https://discord.com/oauth2/authorize?client_id=1473261982386880605&permissions=67584&scope=botをブラウザで開くCLIENT IDは画面で確認。　先にサーバーが必要だったので、テスト用のDiscordサーバーを作成す...

### Prompt 9

https://discord.com/channels/@meでログインして、Discordの左サイドバーの一番下にある 「+」ボタン をクリック
「オリジナルの作成」を選択
「自分と友達のため」を選択
サーバー名を適当につける（例：picoclaw-test）でサーバーを作成。

### Prompt 10

[Image: source: /mnt/c/Users/sato1/OneDrive/画像/Screenshots/スクリーンショット 2026-02-17 195451.png]

[Image: source: /mnt/c/Users/sato1/OneDrive/画像/Screenshots/スクリーンショット 2026-02-17 195530.png]

### Prompt 11

次はconfig.jsonのDiscord設定を有効にして、PicoClawを起動します。
① config.jsonのchannels.discordを編集
json"discord": {
    "enabled": true,
    "token": "BotページでReset Tokenして取得したトークン",
    "allow_from": []
} picoclaw on ⎇ main [?] via 🐹 v1.25.7 🅰 personal-admin  ️G prigela took 52s
> docker compose --profile gateway up -d
[+] Building 20.0s (18/18) FINISHED                                                                          doc...

### Prompt 12

記事に追記して。

### Prompt 13

この画像記事に貼れる?

### Prompt 14

[Image: source: /mnt/c/Users/sato1/OneDrive/画像/Screenshots/スクリーンショット 2026-02-17 200006.png]

### Prompt 15

これでさくらのAI Engine + PicoClaw + Discord連携が完成です。テストサーバーでメンションすれば会話が続けられます。
使い終わったら停止を忘れずに：
bashdocker compose --profile gateway down
HEARTBEATも30分ごとに動いている（HEARTBEAT_OKが出ている）ので、放置するとさくらのAPIトークンを消費し続けます。を書いといて。

### Prompt 16

open src/content/blog/picoclaw-sakura-ai-engine.md

### Prompt 17

src/content/blog/picoclaw-sakura-ai-engine.mdをcommit

### Prompt 18

OpenClawに乗り遅れたら超軽量版PicoClawが出てたのタイトルのボヤキみたいなのを文章の頭に入れてもいいと思う。

### Prompt 19

PicoClawをLLMにさくらのAI Engineで動かす設定手順を書く。これだけじゃなくね?discordもやってるし

### Prompt 20

OpenClawが話題になっていたのは知っていたが、が偉そう

### Prompt 21

[Request interrupted by user for tool use]

### Prompt 22

Go実装で10MB未満のRAMで動く。は序文にいらない

### Prompt 23

10MB未満のRAMで動作する。は試してないので削除したい。

### Prompt 24

参考にしたURLを記事の末尾につけたい。

### Prompt 25

https://zenn.dev/yskst/articles/3309f73a813d1a

### Prompt 26

PicoClawにリンクほしい

### Prompt 27

commit and push

### Prompt 28

この記事で分かること
PicoClawをさくらのAI Engineで動かす設定手順と、Discord Bot連携までの流れを書く。

PicoClawはファイル読み書きやシェルコマンド実行のツールを内蔵している。restrict_to_workspace: true で読み書き先を制限できるが、あくまでLLM向けのガードレール。Docker Composeならコンテナ自体がOSレベルで隔離してくれるので、こちらを選んだ。

PicoClawとは
OpenClawの軽量�...

### Prompt 29

commit and push

### Prompt 30

こちらを選んだ。はどの選択肢から？https://github.com/sipeed/picoclaw

### Prompt 31

はい

### Prompt 32

commit and push

