---
title: AIに規約を守らせたい——仕様駆動開発（SDD）から学べること
description: Claude の rules に書いた規約が守られない問題に対し、仕様駆動開発（SDD）から何を活かせるかを整理する。Kiro の Steering、GitHub spec-kit の Constitution を規約遵守の観点で読み解く。
date: 2026-02-21T12:00:00+09:00
categories:
  - AI
permalink: /spec-driven-development
published: false
---

Claude の rules にコーディング規約を書いても、AI は毎回それを守るとは限らない。命名規則、ディレクトリ構成、エラー処理のパターン——何度指摘しても同じ逸脱が繰り返される。これが自分にとって AI コーディングの最大の課題になっている。

この問題の解決の糸口を探る中で、仕様駆動開発（Spec-Driven Development、以下 SDD）という手法にたどり着いた。本記事では、SDD とは何か、なぜ生まれたのか、どうやって進めるのか、そして規約遵守の問題に何を活かせるのかを整理する。

---

## バイブコーディングの何が問題なのか

自然言語でコードを生成する「バイブコーディング」には、以下の構造的な問題がある。

### 1. 規約が毎回守られない

命名規則、ディレクトリ構成、エラー処理パターンなどのコーディング規約を伝えても、AI は次のタスクや会話で同じ規約に従う保証がない。実装ごとにスタイルがばらつき、コードベースの一貫性が崩れていく。

### 2. 要件を理解する前にコードを生成する

AI は要件を深掘りせず即座にコード生成に入る。手戻りが頻発する。

### 3. 要件・文脈・全体像が会話の中で失われる

やり取りを重ねるとコンテキストウィンドウが埋まり、合意した要件はチャット履歴に埋もれる。意思決定の経緯も残らない。

---

## 仕様駆動開発とは何か

仕様駆動開発（SDD）は、**構造化された自然言語の仕様を先に書き、その仕様に基づいてテストと実装を導出する**開発手法である。仕様が主成果物であり、コードは仕様に従属する。デバッグは「仕様を修正すること」に、リファクタリングは「仕様を再構成すること」に変わる。

---

## Kiro は何を目指していたのか

Kiro は Amazon が開発した AI 開発環境（IDE / CLI）で、2025 年 7 月にプレビュー版がリリースされた。Kiro は SDD を IDE レベルで実現した最初の本格的なツールである。

### パラダイムシフト

Kiro VP の Marc Brooker は、SDD を「1950〜60 年代のプログラミング言語革命以来、最初の大きなプログラミングパラダイムシフト」と位置づけている。プログラミングの焦点が「どう解決するか（How）」から「何を解決するか（What）」に移行するという主張である。

### Kiro が確立した SDD のワークフロー

Kiro は SDD のワークフローを 3 つのフェーズに整理した。

1. **Requirements（要件定義）**: 自然言語のプロンプトから、ユーザーストーリーと EARS 形式の受け入れ条件を生成する
2. **Design（設計）**: コードベースを分析し、アーキテクチャ設計、データフロー図、インターフェース定義を生成する
3. **Tasks（タスク分解）**: 依存関係に基づいて順序付けられた、追跡可能な実装タスクを生成する

### ステアリング（Steering）: プロジェクトの記憶を永続化する

Kiro は**ステアリング（Steering）**という概念を導入した。これはプロジェクトの記憶を永続化する仕組みで、以下の 3 つのファイルから成る。

- **product.md**: プロダクトの概要、主要機能、対象ユーザー
- **tech.md**: 技術スタック、フレームワーク、技術的制約
- **structure.md**: ディレクトリ構成、アーキテクチャパターン、命名規約

新しい機能を開発する際、AI はステアリングを参照して既存のアーキテクチャとの整合性を保つ。特に structure.md は、命名規約やディレクトリ構成をファイルとして永続化する。Claude の rules に規約を書いても守られない問題に対し、「rules ではなく仕様の一部として規約を定義する」というアプローチである。

### 実績

AWS のブログでは、Rackspace Technology が Kiro を使って「52 週分の見積もり作業を 3 週間で完了し、90% の効率向上を達成した」事例が紹介されている。また、創薬エージェントの開発にも SDD が適用され、3 週間で本番投入可能なシステムが構築された。

---

## GitHub spec-kit: もう一つの SDD ツール

GitHub も 2025 年にオープンソースの SDD ツールキット「spec-kit」をリリースした。Kiro とはアプローチが異なるため、両者を比較することで SDD の本質がより明確になる。

### spec-kit のワークフロー

spec-kit は 4 つのフェーズで構成される。

1. **Specify（仕様作成）**: 何を作るか、なぜ作るかを記述する。ユーザーシナリオ、受け入れ条件、エッジケースを含む
2. **Plan（設計）**: 技術的制約、アーキテクチャ、統合要件を明示する。データモデル、API 契約を含む
3. **Tasks（タスク分解）**: 仕様と設計をタスクに分解する。各タスクは独立してテスト可能
4. **Implement（実装）**: AI がタスクに基づいて実装する

### Constitution（憲法）: 不変の原則を定める

spec-kit が Kiro と大きく異なるのは、**Constitution（憲法）**という概念を持つ点である。これはプロジェクトの不変の原則を定めたドキュメントで、すべての仕様と設計がこの原則に準拠しなければならない。

たとえば、以下のような条項が定義される。

- **ライブラリファースト原則**: すべての機能はまず独立したライブラリとして始める
- **テストファースト命令**: テストが書かれ、失敗が確認されるまで実装コードを書いてはならない
- **反抽象化**: フレームワークの機能を直接使い、不要なラッパーを避ける

Constitution は設計フェーズで「Constitution Check」として機能する。rules ファイルに書いた規約は AI が「参考にする」にとどまるが、Constitution はワークフローに組み込まれたゲートであり、すべての設計判断がこの原則を通過しなければならない。規約遵守の問題に対する最も直接的な回答といえる。

### Kiro と spec-kit の比較

| 観点             | Kiro                                          | spec-kit                                           |
| ---------------- | --------------------------------------------- | -------------------------------------------------- |
| 提供元           | Amazon                                        | GitHub                                             |
| 形態             | IDE / CLI                                     | CLI ツールキット                                   |
| ワークフロー     | Requirements → Design → Tasks                 | Specify → Plan → Tasks → Implement                 |
| プロジェクト記憶 | Steering（product.md, tech.md, structure.md） | Constitution（不変の原則）                         |
| 受け入れ条件     | EARS 形式                                     | Given-When-Then 形式                               |
| 対応 AI          | Kiro 内蔵                                     | 20+ エージェント対応（Claude, Copilot, Gemini 等） |
| 成果物の場所     | `.kiro/specs/{feature}/`                      | `specs/{feature}/`                                 |

両者に共通するのは、**仕様を先に書き、AI に仕様に基づいて実装させる**という SDD の核心的アプローチである。

---

## SDD の進め方

SDD の一般的なワークフローは以下のフェーズで構成される。

### Phase 1: 要件定義

「何を作るか」を明確にする。自然言語で機能を説明し、ユーザーストーリーと受け入れ条件を記述する。受け入れ条件は EARS（Easy Approach to Requirements Syntax）形式で書くことが多く、「イベント駆動」「状態駆動」「望ましくない振る舞い」「任意機能」「常時」の 5 パターンに分類することで、テスト可能な条件に落とし込む。成果物は `requirements.md`。

### Phase 2: 設計

「どう作るか」を決める。既存コードベースの調査、アーキテクチャ設計、コンポーネント・インターフェース定義、データモデル定義を行う。要件とコンポーネントの対応表（トレーサビリティテーブル）を作成し、各要件がどのコンポーネントで実現されるかを追跡可能にする。成果物は `design.md`。

### Phase 2.5: 設計レビュー（GO/NO-GO 判定）

実装に進んでよいかを判定するゲート。既存アーキテクチャとの整合性、設計の一貫性と標準準拠、拡張性と保守性、型安全性の 4 観点でレビューし、GO（実装に進む）または NO-GO（設計を修正する）を判定する。成果物は `design-review.md`。

### Phase 3: タスク分解

設計に基づいて実装タスクを生成する。タスクは自然言語で記述し、各タスクに要件 ID を紐づける。成果物は `tasks.md`。

### Phase 4: 実装

タスクに基づいてコードを実装する。すべての実装判断は仕様と設計に基づく。

### Phase 5: 実装検証

実装が仕様を満たしているかを検証する。アーキテクチャレビュー、QA レビュー、実装検証の 3 観点で判定する。成果物は `impl-validation.md`（APPROVE / REJECT）。

---

## PR レビュー負荷の軽減

SDD では設計レビューが実装の前に行われるため、PR レビュー時には設計の妥当性はすでに合意されている。レビュアーはコードの品質と設計への準拠だけに集中できる。要件ドキュメント・設計ドキュメント・タスクリストが存在するため、コードから実装者の意図を逆算する必要もない。仕様という「正解」が手元にある状態で、コードがそれに合致しているかを確認するだけでよい。

---

## SDD の理想と現実

SDD は強力な手法だが、万能ではない。cc-sdd（SDD ツール）の開発者による発表と Martin Fowler サイトの分析記事から、現実の課題を整理する。

### 仕様の肥大化

cc-sdd の開発者の発表では、比較的シンプルな機能でも AI が生成した仕様が 3,590 行以上に膨れ上がったケースが報告されている。「現在の SDD ツールは固定的で高負荷なワークフローを持ち、タスクの規模に応じた適切なサイズの仕様を作ることが難しい」という指摘がある。

### 仕様の正確性を検証する仕組みがない

LLM は確率的な出力を生成するため、仕様だけでは実装の正確性を保証できない。「実装後に仕様の正確性を検証するメカニズムがない」という根本的なギャップが指摘されている。

### エンジニアだけでは完結しない

SDD はエンジニアだけでは完結しない。プロダクトオーナー、マネージャー、ビジネスアナリスト、QA エンジニアが協働する必要がある。組織のプロセス変更を伴う。

### Martin Fowler サイトの批判

Martin Fowler のサイトに掲載された分析記事では、「私はこれらのマークダウンファイルをすべてレビューするよりも、コードをレビューしたい。効果的な SDD ツールは非常に良い仕様レビュー体験を提供しなければならない」という指摘がある。

### SDD が向いている領域・向いていない領域

**向いている領域**:

- 明確な境界を持つ安定した領域（外部 API、データベース整合性）
- 高リスク・規制のある分野（金融計算）
- 要件と開発を分離する組織構造がある場合
- モジュラーなアーキテクチャ

**向いていない領域**:

- 「未知の未知」が多い探索的な開発
- 小さなタスクや単純な修正
- 要件自体がまだ固まっていない初期フェーズ

---

## 規約遵守の問題に SDD は何を活かせるか

SDD のツールと概念を調べた結果、規約遵守の問題に対して以下の示唆が得られた。

### rules ではなく仕様の一部として規約を定義する

Claude の rules ファイルは「参考情報」にとどまり、AI がそれを参照するかは保証されない。一方、Kiro の Steering（特に structure.md）や spec-kit の Constitution は、ワークフローの中で必ず参照される仕様の一部として規約を位置づけている。規約を「ルール」から「仕様」に昇格させることで、参照の強制力が変わる。

### 規約準拠をゲートとして組み込む

spec-kit の Constitution Check は、設計フェーズで規約準拠を検証するゲートである。「規約を書いて祈る」のではなく、ワークフローの中にチェックポイントを設けることで、規約違反を実装前に検出する。SDD の Phase 2.5（設計レビュー）も同じ発想である。

### 規約を検証可能な形で書く

SDD では要件を EARS 形式で書き、曖昧な表現を排除する。同じアプローチを規約にも適用できる。「適切な命名をすること」ではなく「関数名は動詞 + 名詞の形式とする（例: getUser, createOrder）」のように、検証可能な形で規約を記述する。AI が遵守したかどうかを機械的に判定できる規約は、守られやすい。

---

## SDD の成果物の全体像

SDD の各フェーズで生成される成果物を整理する。

```
.kiro/specs/{feature}/
  requirements.md      ... Phase 1: 要件（EARS 形式）
  gap-analysis.md      ... Phase 1.5: ギャップ分析（既存実装がある場合）
  design.md            ... Phase 2: 技術設計
  research.md          ... Phase 2: 調査ログ（設計判断の根拠）
  design-review.md     ... Phase 2.5: 設計レビュー（GO/NO-GO）
  tasks.md             ... Phase 3: 実装タスクリスト
  impl-validation.md   ... Phase 5: 実装検証（APPROVE/REJECT）

.kiro/steering/
  product.md           ... プロダクトの概要
  tech.md              ... 技術スタック
  structure.md         ... プロジェクト構造
```

この構造は Kiro のフォーマットに由来する。成果物はすべてマークダウン形式であり、Git でバージョン管理できる。

---

## まとめ

自分が AI コーディングで最も困っていたのは、rules に書いた規約が毎回守られないことだった。SDD を調べてわかったのは、この問題の本質が「規約の伝え方」ではなく「規約の位置づけ」にあるということである。

SDD は規約を「参考情報」ではなく「仕様の一部」として扱う。Kiro の Steering はプロジェクトの構造・命名規約・技術スタックを仕様ファイルとして永続化し、spec-kit の Constitution はプロジェクトの不変の原則としてすべての設計判断のゲートに組み込む。

SDD のワークフロー全体を導入しなくても、以下の 3 点は今日から実践できる。

1. **規約を仕様として構造化する**: rules の羅列ではなく、Steering や Constitution のように役割ごとにファイルを分け、ワークフローに組み込む
2. **規約を検証可能な形で書く**: 「適切に」ではなく、機械的に判定できる具体的な条件にする
3. **規約準拠のチェックポイントを設ける**: 実装後のレビューだけでなく、設計段階でゲートを設ける

---

## 参考資料

- [Kiro 公式サイト](https://kiro.dev/)
- [Kiro and the future of AI spec-driven software development](https://kiro.dev/blog/kiro-and-the-future-of-software-development/)
- [From chat to specs: a deep dive into AI-assisted development with Kiro](https://kiro.dev/blog/from-chat-to-specs-deep-dive/)
- [チャットから仕様へ : Kiro を用いた AI 支援開発の深掘り（AWS ブログ日本語版）](https://aws.amazon.com/jp/blogs/news/from-chat-to-specs-deep-dive/)
- [From spec to production: a three-week drug discovery agent using Kiro](https://aws.amazon.com/blogs/industries/from-spec-to-production-a-three-week-drug-discovery-agent-using-kiro/)
- [Spec-driven development with AI: Get started with a new open source toolkit（GitHub Blog）](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [GitHub spec-kit リポジトリ](https://github.com/github/spec-kit)
- [Agentic AI, MCP, and spec-driven development: Top blog posts of 2025（GitHub Blog）](https://github.blog/developer-skills/agentic-ai-mcp-and-spec-driven-development-top-blog-posts-of-2025/)
- [Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl（Martin Fowler）](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
- [仕様駆動開発の理想と現実、そして向き合い方（Speaker Deck）](https://speakerdeck.com/gotalab555/shi-yang-qu-dong-kai-fa-noli-xiang-toxian-shi-sositexiang-kihe-ifang)
