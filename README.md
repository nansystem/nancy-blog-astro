# nansystem 技術ブログ

Astro の静的サイトです。記事は `src/content/blog/` の Markdown で管理し、`master` への push を Cloudflare Workers の Git 連携が検知して公開します。

## 記事の更新

1. 編集する checkout で `git status` を確認します。未コミットの編集がなければ `git pull --ff-only` で最新にします。編集が残っている場合は先に保存・commit し、別の checkout の変更を上書きしないでください。
2. `src/content/blog/記事名.md` を作成・編集します。Obsidian にこのフォルダを接続している場合は、Obsidian から直接編集できます。
3. `pnpm install --frozen-lockfile`、`pnpm dev` を実行し、表示された URL（通常 `http://localhost:4321`）で確認します。開発時は `published: false` の下書きも表示されます。
4. 公開する記事だけ `published: true` にし、`pnpm build && pnpm preview` で公開時の表示を確認します。下書きは本番の一覧・記事ページ・RSSから除外されます。
5. 対象の記事と追加画像だけを commit・push します。

```bash
# 実際に記事を編集したリポジトリで実行
pnpm exec textlint src/content/blog/記事名.md
pnpm lint:frontmatter
pnpm build
git add src/content/blog/記事名.md
# 画像を追加した場合は、その画像も git add する
git commit -m "docs: 記事タイトル"
git push origin master
```

Cloudflare のビルド完了後に公開サイト <https://nansystem.com> を確認してください。push 成功とデプロイ成功は別です。

### 新規記事のテンプレート

```markdown
---
title: Reactでフォーム送信を実装して確認したこと
description: 実際に試した内容と、この記事でわかることを具体的に書きます。
date: 2026-09-19
categories:
  - React
permalink: /react-form-example
published: false
---

導入文を書きます。

## 試したこと

検証した手順と結果を書きます。
```

`permalink` は先頭に `/` を付け、末尾に `/` を付けません。既存記事の URL は変更しないでください。本文の見出しは `##` から始め、React 関連の記事は `React` カテゴリにします。

### Obsidian と複数の checkout

従来の構成は Windows の `C:\repos\nancy-blog-astro` を記事執筆用、WSL をコード修正用としていました。Obsidian vault 内の `nancy-blog` から Windows 側の `src\content\blog` へシンボリックリンクを張る構成です。パスは PC ごとに異なるため、Obsidian のフォルダが実際にどの checkout を参照しているか確認してください。

この作業環境の WSL checkout は `/home/nancy/src/github.com/nansystem/nancy-blog-astro` です。Windows 側の上記パスはこの環境では確認できていません。Obsidian の記事がこの WSL checkout にない場合、編集したファイルの所在を確認してから、その checkout で commit・push してください。

片方から push したら、もう片方も編集開始前に `git pull --ff-only` します。競合する場合は強制的に上書きせず差分を確認します。

## 開発環境

Node.js は `.node-version` / `.nvmrc`、pnpm は `package.json` の `packageManager` に固定しています。Node.js のバージョン管理ツールで指定バージョンを導入してください。

```bash
nvm install
nvm use
npm install --global pnpm@12.4.2
pnpm install --frozen-lockfile
pnpm dev
```

| コマンド                | 用途                       |
| ----------------------- | -------------------------- |
| `pnpm dev`              | 下書きを含む開発プレビュー |
| `pnpm check`            | Astro / TypeScript の検証  |
| `pnpm build`            | 公開記事を `dist/` に生成  |
| `pnpm preview`          | 本番ビルドのローカル確認   |
| `pnpm lint:text`        | 記事の文章ルール確認       |
| `pnpm lint:frontmatter` | 記事情報の表記ゆれ確認     |

## デプロイ

Cloudflare Workers の Git 連携でビルドコマンド `pnpm build`、デプロイコマンド `pnpm exec wrangler deploy` を使用します。Wrangler は開発依存としてバージョン管理しています。

- Workers の静的アセット設定は `wrangler.jsonc` の `assets.directory` です。
- `not_found_handling: "404-page"` により存在しない URL は404になります。
- `wrangler pages deploy` は使用しません。
- Git 連携の自動生成トークンを使用し、ビルド環境に `CLOUDFLARE_API_TOKEN` を追加しません。
- Cloudflare 側で `NODE_VERSION` / `PNPM_VERSION` を設定済みの場合、リポジトリの指定と一致させてください。

Astro の更新時は [公式の移行ガイド](https://docs.astro.build/en/guides/upgrade-to/v7/) も確認してください。既存の rehype プラグインを使うため Markdown は `@astrojs/markdown-remark` の `unified()` を使用しています。
