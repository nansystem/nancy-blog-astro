---
title: claude -w の worktree に .env と node_modules を引き継ぐ git 組み込みの post-checkout フックを検証した
description: Claude Code 2.1.49で追加された-wフラグで作成したworktreeに、gitignoreされた.envや依存関係を引き継ぐ方法をpost-checkoutフックで検証した。フックの発火確認・.envコピー・pnpm installの3ステップで実測する。
date: 2026-02-21T12:00:00+09:00
categories:
  - AI
permalink: /claude-code-parallel-development-with-worktree
published: true
---

Claude Code 2.1.49 で `--worktree (-w)` フラグが追加された。worktree 作成時、コミットしていない `.env` や独自の rules・skills、`node_modules` などの依存関係は引き継がれないのが面倒だ。Claude Code の開発者 Boris Cherny が「You can also customize it with worktree hooks」と言っているので、git の標準的な [post-checkout フック](https://git-scm.com/docs/githooks#_post_checkout)でこの問題を解決できるか確認した。

<div style="display: flex; justify-content: center;">
<blockquote class="twitter-tweet"><p lang="en" dir="ltr">We directly use git worktrees <a href="https://t.co/nscHRomzz7">https://t.co/nscHRomzz7</a><br><br>You can also customize it with worktree hooks</p>&mdash; Boris Cherny (@bcherny) <a href="https://twitter.com/bcherny/status/2025009267653443698?ref_src=twsrc%5Etfw">February 21, 2026</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</div>

なお、git worktree・bare clone・git clone --shared の仕組みは[並行開発のための git コマンド](/git-parallel-development-guide)にまとめた。

## Claude Code の `--worktree` フラグ

Claude Code 2.1.49 で追加された `-w` フラグを使うと、コマンド1つで worktree を作りセッションを起動できる。

```bash
$ claude -w feature1

    ✻
    |
   ▟█▙     Claude Code v2.1.50
 ▐▛███▜▌   Sonnet 4.6 · Claude Max
▝▜█████▛▘  ~/sandbox/.claude/worktrees/feature1
  ▘▘ ▝▝
```

カレントディレクトリが `.claude/worktrees/feature1/` に切り替わった状態でセッションが始まる。

```bash
# 名前を省略するとランダム生成
claude -w
# → .claude/worktrees/bright-running-fox/ のような名前になる
```

worktree は `<リポジトリルート>/.claude/worktrees/<name>/` に作られる。`.gitignore` に追加しておくとよい。

```
# .gitignore
.claude/worktrees/
```

セッション終了時の挙動も Claude Code が担う。

- **変更なし** → worktree とブランチを自動削除
- **変更あり** → 残す・削除を確認するプロンプトが出る

`-w` フラグは worktree の作成とセッション起動を自動化するが、`.env` など gitignore されたファイルは引き継がない。

## .env 問題の解決策：post-checkout フック

`claude -w` を実行すると内部で `git worktree add` が走り、`post-checkout` フックが発火する。3つのステップで段階的に確認する。

### ステップ1：フックが呼ばれることを確認

まずログファイルに書き出すだけのシンプルなフックで、引数を確認する。`.git/hooks/post-checkout` に以下を置き、実行権限を付与する。

```bash
#!/bin/bash
# .git/hooks/post-checkout
echo "[post-checkout] called: PREV=$1 NEW=$2 FLAG=$3" >> /tmp/hook.log
```

```bash
chmod +x .git/hooks/post-checkout
```

```bash
$ claude -w hook-check
# セッション終了後
$ cat /tmp/hook.log
[post-checkout] called: PREV=0000000000000000000000000000000000000000 NEW=7ad227ae81e2ede5172856ef5155491f3e19f2bb FLAG=1
```

フックが呼ばれ、3つの引数が渡されることを確認できた。

| 引数        | 値                 | 意味                                                                  |
| ----------- | ------------------ | --------------------------------------------------------------------- |
| `$1` (PREV) | `000...000`        | worktree add 時は全ゼロ（通常のブランチ切り替えは実コミットハッシュ） |
| `$2` (NEW)  | 実コミットハッシュ | チェックアウト先のコミット                                            |
| `$3` (FLAG) | `1`                | `1` = ブランチチェックアウト、`0` = ファイルチェックアウト            |

`$1` が全ゼロかどうかで「worktree add によるフック呼び出し」と「通常の `git checkout`」を区別できる。

### ステップ2：.env がコピーできることを確認

フックに `.env` のコピー処理を追加する。

```bash
#!/bin/bash
# .git/hooks/post-checkout
[ "$1" != "0000000000000000000000000000000000000000" ] && exit 0

WORKTREE_DIR="$(pwd)"
MAIN_DIR="$(realpath "$(git rev-parse --git-common-dir)/..")"

if [ -f "$MAIN_DIR/.env" ]; then
    cp "$MAIN_DIR/.env" "$WORKTREE_DIR/.env"
fi
```

```bash
$ claude -w env-check
# セッション終了後
$ ls -la .claude/worktrees/env-check/.env
-rw-r--r-- 1 nancy nancy 222 Feb 21 17:04 .claude/worktrees/env-check/.env
```

`.env` がコピーされていた。

### ステップ3：依存関係を解決できることを確認

フックに `pnpm install` を追加する。`pnpm-lock.yaml` は git 管理しておく必要がある。gitignore されていると worktree にコピーされず、`pnpm install` が空振りする。

```bash
#!/bin/bash
# .git/hooks/post-checkout
[ "$1" != "0000000000000000000000000000000000000000" ] && exit 0

WORKTREE_DIR="$(pwd)"
MAIN_DIR="$(realpath "$(git rev-parse --git-common-dir)/..")"

if [ -f "$MAIN_DIR/.env" ]; then
    cp "$MAIN_DIR/.env" "$WORKTREE_DIR/.env"
fi

# node_modules を共有すると依存変更が全 worktree に影響するため、個別にインストール
pnpm install
```

```bash
$ claude -w deps-check
# セッション終了後
$ ls .claude/worktrees/deps-check/node_modules/
dayjs
```

`.env` とパッケージが揃った状態で worktree が起動する。

## まとめ

`.env` のコピーも依存関係の解決も、git 標準の `post-checkout` フックで対応できた。`claude -w` は内部で `git worktree add` を実行するため、フックは自動的に発火する。
