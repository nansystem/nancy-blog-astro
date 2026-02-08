# CLAUDE.md

## プロジェクト概要

Astro v5 の静的サイト。Cloudflare Workers (GitHub連携) でデプロイ。

- ビルド: `npm run build` → `dist/` に出力
- デプロイ: Cloudflare の Git 連携で push 時に自動ビルド & `npx wrangler deploy`

## Cloudflare デプロイ時の注意事項

### Workers モードと Pages モードを混同しない

Cloudflare には2つのデプロイモードがある。設定を間違えるとデプロイが壊れる。

| 項目 | Workers (推奨・このプロジェクト) | Pages (レガシー) |
|---|---|---|
| wrangler.jsonc の出力先キー | `assets.directory` | `pages_build_output_dir` |
| デプロイコマンド | `npx wrangler deploy` | `npx wrangler pages deploy dist` |
| 404 ハンドリング | `not_found_handling` の明示設定が必要 | 自動 |

**`wrangler pages deploy` と `wrangler deploy` は別物。** Workers モードで `wrangler pages deploy` を使うと認証エラーになる。

### カスタムドメイン設定時は既存DNSレコードを先に削除する

`wrangler.jsonc` の `routes` でカスタムドメインを設定する際、対象ホスト名に既存の A/CNAME レコードがあるとエラーになる。

```
Hostname 'nansystem.com' already has externally managed DNS records (A, CNAME, etc).
```

Cloudflare ダッシュボードの DNS ページで該当レコードを削除してからデプロイする。

### ビルド環境に CLOUDFLARE_API_TOKEN を設定しない

Cloudflare Pages/Workers の Git 連携ビルドでは自動生成されるビルドトークンが使われる。プロジェクトの環境変数に `CLOUDFLARE_API_TOKEN` を設定すると、ビルドトークンが上書きされて認証エラーになる。

## 開発環境

リポジトリが2箇所にある。用途で使い分ける。

| 場所 | パス | 用途 |
|---|---|---|
| WSL | `/home/nancy/ghq/github.com/nansystem/nancy-blog-astro` | レイアウト・コード修正、`npm run dev` |
| Windows | `C:\repos\nancy-blog-astro` | Obsidian で記事執筆 → push でデプロイ |

**片方で push したら、もう片方で `git pull` すること。** 同じブランチを両方で編集すると競合する。

## 記事の管理と執筆

### Obsidian 連携

リポジトリは Windows 側 `C:\repos\nancy-blog-astro` にクローンしてある。
Obsidian vault (`C:\obsidian\remote`) にシンボリックリンクで記事フォルダを接続。

```
C:\obsidian\remote\nancy-blog → C:\repos\nancy-blog-astro\src\content\blog
```

- Obsidian で `nancy-blog` フォルダ内の記事を直接編集できる
- パスはPCごとに異なる可能性がある。シンボリックリンクの再作成は管理者 PowerShell で:
  ```powershell
  New-Item -ItemType SymbolicLink -Path "C:\obsidian\remote\nancy-blog" -Target "C:\repos\nancy-blog-astro\src\content\blog"
  ```

### 記事のリリースフロー

1. Obsidian で記事を書く・編集する
2. WSL ターミナルで:
   ```bash
   cd /mnt/c/repos/nancy-blog-astro
   git add src/content/blog/記事名.md && git commit -m "docs: 記事タイトル" && git push
   ```
3. push で Cloudflare が自動ビルド & デプロイ

## 記事設計ガイドライン（住太陽 SEO理論準拠）

### 記事執筆の原則

- **一次情報を最優先する。** 自分が実際に体験・検証したプロセス、具体的な費用・期間・困難とその克服を書く。AIが生成できる一般的な知識の再構成は避ける。
- **主観と意見を明記する。** 経験に基づいた独自の洞察、提言、感想を盛り込む。「おすすめ」「良かった点」「失敗した点」など、書き手の判断を示す。
- **認知的信頼と感情的信頼を両立する。** 専門知識・正確なデータ（認知的信頼）に加え、なぜこの情報を発信しているのかという動機や熱意（感情的信頼）を織り込む。

### 記事の構成ルール

1. **見出し階層を厳守する。** h1（タイトル）→ h2 → h3 の入れ子構造を崩さない。
2. **キーワードは見出しの先頭15〜20文字以内に配置する。**
3. **検索意図を意識する。** Know（知りたい）/ Go（行きたい）/ Do（やりたい）/ Buy（買いたい）のどれに応えるかを明確にする。
4. **ロングテールキーワードを狙う。** 具体的で絞り込まれたキーワードほど、有望な読者を連れてくる。
5. **内部リンクのアンカーテキストは具体的に。** 「こちら」ではなくリンク先の内容を端的に説明する。

### トピッククラスター戦略

記事を独立した「点」にせず、サイト全体を「面」として強化する。

- **ピラーページ**: 広範なテーマを網羅的に解説するまとめ記事。関連するクラスターページすべてにリンクする。
- **クラスターページ**: テーマ内の特定のキーワードを深掘りした記事。必ずピラーページへリンクを戻す。

### 記事の frontmatter テンプレート

```markdown
---
title: キーワードを含む具体的なタイトル
description: 記事の要約（120文字程度）
date: YYYY-MM-DD
categories:
  - カテゴリ名
tags:
  - タグ1
  - タグ2
permalink: /url-slug
published: false
---
```

### 公開前チェックリスト

- [ ] タイトルと見出しにキーワードが先頭寄りに配置されているか
- [ ] h1 → h2 → h3 の階層構造が正しいか
- [ ] 自分だけが持つ一次情報（体験、検証結果、プロセス）が含まれているか
- [ ] 書き手の主観的な意見・感想が盛り込まれているか
- [ ] AIが数秒で回答できる一般情報の再構成に留まっていないか
- [ ] 関連記事への内部リンクが具体的なアンカーテキストで設置されているか
- [ ] 読者が次に取るべきアクション（関連記事への誘導）が明確か
- [ ] `published: true` に変更したか

### wrangler.jsonc の現在の設定

```jsonc
{
  "name": "nancy-blog-astro",
  "compatibility_date": "2026-02-08",
  "assets": {
    "directory": "./dist"  // Workers モードの設定キー
  },
  "routes": [
    { "pattern": "nansystem.com", "custom_domain": true }
  ]
}
```
