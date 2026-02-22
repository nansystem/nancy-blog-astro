---
title: picoclaw の HEARTBEAT は単なる cron ではなく「AIが定期的に考える」仕組みだった
description: $10のRISC-Vボードで動く軽量AIエージェントフレームワーク picoclaw の HEARTBEAT を調べた。cron との違い、spawn によるサブエージェントの非同期実行、そしてforkの判断がすべてLLM任せである実態を解説する。
date: 2026-02-22T12:00:00+09:00
categories:
  - AI
permalink: /picoclaw-heartbeat
published: false
---

[picoclaw](https://github.com/sipeed/picoclaw) は Go で書かれた超軽量パーソナル AI エージェントだ。メモリフットプリントが 10MB 未満で、$10 の RISC-V ボード（LicheeRV-Nano）でも動く。HEARTBEAT を試したところ「単なる cron ではないか」と思ったが、調べると大きな違いがあった。

## HEARTBEAT とは

ワークスペースの `HEARTBEAT.md` に書いたタスクを定期的（デフォルト 30 分）に AI が読んで実行する仕組みだ。

```markdown
# Periodic Tasks

- ニュースをチェックして重要なものだけ教えて
- 天気予報を取得してレポートして
```

仕組みはシンプルで、`heartbeat/service.go` が以下のプロンプトを組み立てて AI に渡す。

```
# Heartbeat Check

Current time: 2026-02-22 12:00:00

You are a proactive AI assistant. This is a scheduled heartbeat check.
Review the following tasks and execute any necessary actions using available skills.
If there is nothing that requires attention, respond ONLY with: HEARTBEAT_OK

[HEARTBEAT.md の内容]
```

## cron との違い

一見すると cron と変わらないが、決定的な違いは **LLM が間に入る**点だ。

|              | cron                   | HEARTBEAT                        |
| ------------ | ---------------------- | -------------------------------- |
| タスク形式   | JSON 構造化            | 自然言語 Markdown                |
| 実行エンジン | スケジューラが直接実行 | AI が解釈して実行                |
| ツール利用   | なし                   | web 検索・ファイル操作・spawn 等 |

cron は「毎朝 9 時にメッセージを送れ」→ そのまま送る。HEARTBEAT は「ニュースをチェックして重要なものだけ教えて」→ AI が `web_search` を使って調べ、重要かどうか判断して、結果だけ Telegram に通知する。

ただし標準で使えるツールは `web_search`・`web_fetch`・ファイル操作・`exec` に限られ、メール・カレンダー等の統合は存在しない。「判断を AI に委ねられる」対象は Web 上の公開情報だ。メールのような認証が必要なものは事前に CLI ツールの準備が必要になる。

## spawn によるサブエージェントの非同期実行

HEARTBEAT 実行中に AI が重いタスクと判断したとき、`spawn` tool を呼んでサブエージェントをバックグラウンドで実行できる。

```mermaid
sequenceDiagram
    participant H as HEARTBEAT
    participant A as メインAI
    participant S as サブエージェント
    participant T as Telegram

    H->>A: HEARTBEAT.md を渡す
    A->>A: タスクA（軽い）を直接実行
    A->>T: タスクA の結果を送信
    A->>S: spawn（タスクB を goroutine で起動）
    Note over A,S: メインAI はブロックされない
    A->>A: タスクC（軽い）を直接実行
    A->>T: タスクC の結果を送信
    Note over A: メインAI 終了
    S->>S: タスクB を実行中（web_search 等）
    S->>T: タスクB の結果を送信
```

`spawn.go` を見ると `SubagentManager.Spawn()` は `go sm.runTask(...)` で goroutine を起動して即リターンする。`AsyncResult()` を返すのでメイン AI はブロックされない。

## forkするかどうかの判断はLLM任せ

「この処理は重いからforkしよう」という判定コードはプログラム側に**一切ない**。

`spawn` tool の description がそのまま LLM への判断基準になっている。

```go
func (t *SpawnTool) Description() string {
    return "Spawn a subagent to handle a task in the background. " +
           "Use this for complex or time-consuming tasks that can run independently. " +
           "The subagent will complete the task and report back when done."
}
```

さらにデフォルトの `HEARTBEAT.md` テンプレートにも明示的なヒントが書かれている。

```markdown
- For simple tasks (e.g., report current time), respond directly.
- For complex tasks that may take time, use the spawn tool to create a subagent.
- After spawning a subagent, CONTINUE to process remaining tasks.
```

つまり **プロンプトエンジニアリングで制御している**。

## subagent の実体

プロセスは起動せず、スレッドも作らない。`subagent.go` の `runTask` を見ると、実態はメインエージェントと同じ `RunToolLoop` 関数を goroutine で呼んでいるだけだ。

```mermaid
flowchart LR
    subgraph main["メインエージェント"]
        M[RunToolLoop]
    end
    subgraph sub["サブエージェント（goroutine）"]
        S[RunToolLoop]
    end

    M -->|go sm.runTask| S
    S -->|bus.PublishInbound| M
```

メインエージェントとの違いはセッション履歴がない点とシステムプロンプトが `SOUL.md` 等ではなく固定文字列な点だけだ。「fork」というより**使い捨ての LLM セッションを goroutine で実行する**が正確な表現だ。

## まとめ

picoclaw の HEARTBEAT が cron と異なる点は「コマンドを実行する」のではなく「AI が状況を判断して行動する」ことだ。spawn によるサブエージェントも、新プロセスのような大仰なものではなく goroutine + 使い捨て LLM セッションのシンプルな実装になっている。そしてすべての「判断」はプロンプトと tool description によるもので、プログラムに判定ロジックはない。
