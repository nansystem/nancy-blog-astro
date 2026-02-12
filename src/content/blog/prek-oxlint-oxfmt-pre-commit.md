---
title: ESLintより10倍速い oxlint + oxfmt で pre-commit を高速化する
description: ESLint約3,100ms→oxlint約290msと約10倍速い。Rust製のprek・oxlint・oxfmtでコミット時のリント・フォーマットを高速化する設定手順を紹介する。
date: 2026-02-12
categories:
  - JavaScript
permalink: /prek-oxlint-oxfmt-pre-commit
published: true
---

## この記事でやること

コミット時に自動でリントとフォーマットが走る環境を、prek + oxlint + oxfmt で構築する。ESLint + Prettier の代替で、Rust 製なので速い。

[oxlint の公式サイト](https://oxc.rs/docs/guide/usage/linter)には「Oxlint is 50 to 100 times faster than ESLint」と書かれている。実務に比べれば小規模だが、個人開発している在庫管理システム（Next.js + Hono のモノレポ、TS/TSXファイル301個）で実際に計測した結果がこちら。

| ツール | 実行時間 | 既存ツール         | 速度比     |
| ------ | -------- | ------------------ | ---------- |
| oxlint | 約290ms  | ESLint 約3,100ms   | 約10倍速い |
| oxfmt  | 約470ms  | Prettier 約3,400ms | 約7倍速い  |

公式の50〜100倍には届かなかったが、それでも10倍速い。AIコーディングによって開発速度が従来とは比にならないほど上がっている今、コミットのたびに走る lint・format の待ち時間を短くできる恩恵は大きい。この規模でこれだけ差が出るなら、ファイル数の多いプロジェクトでは一度計測してみる価値はあると思う。

本ブログは Astro 製で、以下はそのリポジトリに導入した際の手順になる。JS/TSファイルにはoxlintでリントを、md/mdxファイルにはoxfmtでフォーマットを適用する構成にした。

## prek・oxlint・oxfmt とは

| ツール                                             | 役割                        | 既存ツールとの対応           |
| -------------------------------------------------- | --------------------------- | ---------------------------- |
| [prek](https://github.com/j178/prek)               | pre-commit フック管理       | pre-commit (Python製) の代替 |
| [oxlint](https://oxc.rs/docs/guide/usage/linter)   | JS/TS のリンター            | ESLint の代替                |
| [oxfmt](https://oxc.rs/docs/guide/usage/formatter) | JS/TS/md 等のフォーマッター | Prettier の代替              |

3つとも Rust で書かれている。oxlint と oxfmt は [oxc プロジェクト](https://oxc.rs/) のツール群で、ツール間の相性を気にしなくてよい。prek は Python 製の pre-commit と `.pre-commit-config.yaml` の書式互換があり、既存の設定ファイルをほぼそのまま使える。

## セットアップ手順

### pnpm でインストール

prek と oxfmt を devDependencies に追加する。oxlint は prek が `.pre-commit-config.yaml` の設定に従って自動ダウンロードするため、手動インストールは不要。

```bash
pnpm add -D @j178/prek oxfmt
```

### .pre-commit-config.yaml の作成

プロジェクトルートに `.pre-commit-config.yaml` を作成する。

```yaml
repos:
  # リモートリポジトリからフックを取得するパターン
  - repo: https://github.com/oxc-project/mirrors-oxlint
    rev: v1.46.0 # 使用するバージョンを固定
    hooks:
      - id: oxlint # リポジトリ側で定義済みのフックIDを指定

  # ローカルで自前定義するパターン
  - repo: local
    hooks:
      - id: oxfmt
        name: oxfmt (md/mdx) # 実行時の表示名
        entry: npx oxfmt --write # 実行するコマンド
        language: system # ローカルの実行環境をそのまま使う
        files: \.(md|mdx)$ # 対象ファイルを正規表現で絞り込む
```

### リモートとローカル、2つのフック定義パターン

`.pre-commit-config.yaml` のフック定義には、リモートとローカルの2パターンがある。

**リモート（`repo: URL`）** は、ツール側が公開しているミラーリポジトリを指定する方法。prek がツールのダウンロードから実行まですべて自動で処理する。バージョン指定（`rev`）だけで完結し、CI やチームメンバーの環境でも prek さえあれば動くため、ミラーリポジトリがあるならこちらを使う。

**ローカル（`repo: local`）** は、`entry` に指定したコマンドをそのまま実行する方法。ミラーリポジトリがないツールや、プロジェクト固有のスクリプトに使う。

リモートリポジトリからのダウンロードは初回実行時のみで、以降はローカルにキャッシュされる。コミットのたびにネットワークアクセスが発生するわけではない。

| 項目                 | リモート（oxlint）       | ローカル（oxfmt）        |
| -------------------- | ------------------------ | ------------------------ |
| `repo`               | GitHub の URL            | `local`                  |
| ツールのインストール | prek が自動取得          | 自分で `pnpm add`        |
| フックの実行方法     | リポジトリ内の定義に従う | `entry` に書いたコマンド |

### prek install でフックを登録

```bash
npx prek install
```

`.git/hooks/pre-commit` にフックスクリプトが生成される。以降、`git commit` のたびに prek が `.pre-commit-config.yaml` に定義したフックを実行する。

## 動作確認

全ファイルに対してフックを手動実行して、設定が正しいか確認する。

```bash
npx prek run --all-files
```

問題がなければ、各フックが `Passed` と表示される。

```
oxlint...................................................................Passed
oxfmt (md/mdx)...........................................................Passed
```

実際に `git commit` すると、ステージングされたファイルのうち対象の拡張子にマッチするものだけにフックが走る。oxfmt がフォーマットを修正した場合は差分が出るので、再度 `git add` してコミットし直す。

## まとめ

- oxlint は ESLint の約10倍、oxfmt は Prettier の約7倍速い（TS/TSXファイル301個で計測）
- prek + oxlint + oxfmt はすべて Rust 製で、Python 環境も不要
- `.pre-commit-config.yaml` に2つのフックを定義し、`prek install` するだけで導入できる
- oxfmt がフォーマットを修正した場合は再度 `git add` してコミットし直す
