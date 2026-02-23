---
title: AIオーケストレーションを理解したい（1）AI エージェントを自作する
description: マルチエージェントの協調動作を理解するための第一歩として、シングルエージェントをゼロから自作する。CLI・Gemini API呼び出し・ビルトインツール・自作ツール・ループ実行の5ステップで、LLM がツールを呼び出すループを手を動かしながら腹落ちさせる。
date: 2026-02-23
categories:
  - AI
permalink: /ai-orchestration-1-single-agent
published: true
---

AI オーケストレーションを理解したい。前の記事で [PicoClaw の HEARTBEAT](/picoclaw-heartbeat) を知ったため、そこからワークフローを動かせたら面白そうだからだ。

そこで、オーケストレーションの前に AI エージェントの基本的な作り方を試してみる。AI エージェントとは、LLM が「次に何をするか」を判断し、ツールを呼び出して外部と連携し、その結果を踏まえてまた判断する。そうしたループを回すシステムのことだ。

この記事では、LLM がツールを呼び出すループを5つのステップで作り、シングルエージェントを実装する。

## 1. CLI で入力を受け取り返す

まず AI とは関係なく、標準入力を受け取って返すだけの CLI を作る。

```ts
import * as readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

console.log('Type something (type "exit" to quit):');
process.stdout.write("You: ");

rl.on("line", (line) => {
  const input = line.trim();
  if (input === "exit") {
    rl.close();
    return;
  }
  console.log(`Echo: ${input}`);
  process.stdout.write("You: ");
});
```

`readline.createInterface` で標準入力を行単位で受け取る。`terminal: false` は入力のエコーを無効にするオプションだ。

実行するとこうなる。特に面白味もなく、オウム返し。

```
$ pnpm run step1
Type something (type "exit" to quit):
You: こんにちは
Echo: こんにちは
You: ありがとう
Echo: ありがとう
```

---

## 2. Gemini API をシンプルに呼び出す

ツールを使わずにテキストを送ってテキストを受け取る。まずレスポンスのパターンを確認することが大事だ。

```ts
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const chat = ai.chats.create({
  model: "gemini-2.5-flash-lite",
});

const response = await chat.sendMessage({ message: "こんにちは" });

console.log("text        :", response.text); // "こんにちは！..."
console.log("functionCalls:", response.functionCalls); // undefined（ツールなし）
```

レスポンスには2つのフィールドがある。

```ts
{
  text: "こんにちは！...", // Gemini のテキスト回答
  functionCalls: undefined, // 呼び出したいツールの一覧（ツールなしなので常に undefined）
}
```

`ai.chats.create()` でチャットセッションを開始すると、会話履歴が SDK 内部で保持される。毎回の `sendMessage` で履歴が積み重なっていく。

実行するとこうなる。AIが返事してくれた！オウム返しよりうれしい。

```
$ pnpm run step2
Gemini chat (type "exit" to quit):
You: あなたは誰ですか?
--- response ---
text       : 私はGoogleによってトレーニングされた、大規模言語モデルです。
functionCalls: undefined
```

---

## 3. ビルトインツールを使う

Gemini が標準で持つビルトインツールがある。`googleSearch` はその一つで、`tools` に指定するだけで使える。

```ts
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-lite",
  contents: "今日の東京の天気は？",
  config: {
    tools: [{ googleSearch: {} }], // {} はデフォルト設定で有効化
  },
});
```

実行するとこうなる。最新の情報を取得して表示してくれる。

```
--- response ---
text        : 今日の東京の天気は晴れで、最高気温は23℃、最低気温は12℃の予報です。...
functionCalls: undefined
----------------
```

`googleSearch` を外して同じ質問をするとどうなるか。

```
今日の東京の天気は、晴れ時々曇りで、最高気温は27℃、最低気温は20℃の予想です。
午後は次第に雲が広がりやすくなるでしょう。
```

めっちゃ嘘ついてくる。これがハルシネーションですか。

では「どのクエリで検索が必要か」をアプリ側で判断しなければならないのか。[公式ドキュメント](https://ai.google.dev/gemini-api/docs/google-search)によると、その必要はない。**Dynamic Retrieval**（動的取得）という仕組みで、Gemini 自身がプロンプトごとに検索の必要性を自動判断してくれる。

```ts
tools: [
  {
    googleSearch: {
      dynamicRetrievalConfig: {
        dynamicThreshold: 0.7, // 0〜1。高いほど検索が実行されにくくなる（省略可）
      },
    },
  },
];
```

API がプロンプトに 0〜1 のスコアを付け、`dynamicThreshold` を超えたときだけ検索を実行する。超えなければ Gemini の学習データだけで応答する。`googleSearch: {}` では全クエリで検索が走るのに対し、Dynamic Retrieval を使うとコストとレイテンシを抑えられる。なお Google の公式ドキュメントでは、ハルシネーションを削減できるとしている。

`googleSearch` 以外にも `codeExecution`（Pythonコードの実行）や `urlContext`（URLのコンテキスト取得）が用意されている。ただし Dynamic Retrieval は `googleSearch` のみで指定できる。

---

## 4. 自作ツールを渡す

Claude Code などを使っているとローカルのファイルを検索・編集するのが当たり前に感じるが、API 呼び出しの場合はローカルファイルにアクセスするビルトインツールが存在しない。そこで自作ツールを使う。

```ts
import "dotenv/config";
import { GoogleGenAI, Type, createPartFromFunctionResponse } from "@google/genai";
import * as fs from "node:fs/promises";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Gemini に渡すツール
const readFileTool = {
  declaration: {
    name: "read_file",
    description: "ファイルの内容を読み込んで返す",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "ファイルパス" },
      },
      required: ["path"],
    },
  },
  execute: async (args: { path: string }) => {
    return await fs.readFile(args.path, "utf-8");
  },
};

const chat = ai.chats.create({
  model: "gemini-2.5-flash-lite",
  config: {
    // declaration だけを Gemini に渡す
    tools: [{ functionDeclarations: [readFileTool.declaration] }],
    // gemini-2.5-flash-lite は thinking モデルのため、ツール応答が空になることがある
    // thinkingBudget: 0 で thinking を無効化して安定させる
    thinkingConfig: { thinkingBudget: 0 },
  },
});

const response = await chat.sendMessage({
  message: "package.json の name フィールドを教えて",
});

console.log("functionCalls:", JSON.stringify(response.functionCalls, null, 2));
// → [{ id: "...", name: "read_file", args: { path: "package.json" } }]
```

Gemini は `execute` の中身を知らない。`description` を読んで「このツールを呼べばファイルを読める」と判断するだけだ。

`functionCalls` が返ってきたら、アプリ側でツールを実行して結果を Gemini に返す。

```ts
const fc = response.functionCalls![0];

// アプリ側でファイルを読む（Gemini ではなくローカルの Node.js が実行）
const result = await readFileTool.execute(fc.args as { path: string });

// 結果を functionResponse として Gemini に返す
const toolResponse = createPartFromFunctionResponse(fc.id ?? "", fc.name ?? "", {
  output: result,
});
const finalResponse = await chat.sendMessage({ message: [toolResponse] });
console.log(finalResponse.text); // "The value of the name field in package.json is \"gemini-tool-calling\"."
```

`createPartFromFunctionResponse` は結果を Gemini SDK が要求する `Part` 形式に変換するヘルパーだ。`id` を含めることで Gemini が「このレスポンスはどの `functionCall` に対応するか」を紐付けられる。

実行するとこうなる。

```
$ pnpm run step3
You: package.json の name フィールドを教えて

--- response ---
text        : undefined
functionCalls: [
  {
    "name": "read_file",
    "args": {
      "path": "package.json"
    }
  }
]

Gemini: The value of the name field in package.json is "gemini-tool-calling".
```

1 回目のレスポンスは `text: undefined` で `functionCalls` だけが返ってきた。アプリ側でファイルを読んで結果を渡すと、2 回目のレスポンスで最終回答が返ってきた。

---

## 5. ループで実行する

前の手順では1往復だけだった。実際には Gemini が複数回ツールを呼び出すことがある。`functionCalls` が返ってくる間はループを続け、`text` が返ってきたら終了する。

```ts
import { Part } from "@google/genai";

async function run(userInput: string): Promise<string> {
  // 最初は string、2回目以降は Part[]
  let currentInput: string | Part[] = userInput;

  while (true) {
    const response = await chat.sendMessage({ message: currentInput });

    // functionCalls がなければ最終回答
    if (!response.functionCalls || response.functionCalls.length === 0) {
      return response.text ?? "";
    }

    // ツールを実行して Part[] を作る
    const results: Part[] = await Promise.all(
      response.functionCalls.map(async (fc) => {
        const result = await readFileTool.execute(fc.args as { path: string });
        return createPartFromFunctionResponse(fc.id ?? "", fc.name ?? "", { output: result });
      }),
    );

    // 結果を渡して続きを聞く
    currentInput = results;
  }
}
```

`currentInput` の型が `string | Part[]` になっている理由は、最初のメッセージは `string` で送れるが、ツール結果を返すときは `Part[]` でなければならないためだ。

処理の流れはこうなる。

```
run("package.json と tsconfig.json の内容を教えて")
  ↓
functionCalls: [read_file("package.json"), read_file("tsconfig.json")]
  ↓
2ファイルを並列で読み込む（Promise.all）
  ↓
結果を Part[] で返す
  ↓
functionCalls: なし
text: "package.json は ... tsconfig.json は ..."
  ↓
終了
```

`text` が返ってきた時点で Gemini がこれ以上ツールは不要と判断したことを意味する。ツールが何度必要でも、最終的に1つの `text` レスポンスにまとまる。

実行するとこうなる。複数ファイルを指定すると、1回の応答で2つの `functionCalls` が返り、`Promise.all` で並列処理される。

```
$ pnpm run step4
You: package.json と tsconfig.json を読んで、それぞれの name と compilerOptions.target を教えて
Gemini: package.json の name は gemini-tool-calling で、tsconfig.json の compilerOptions.target は ES2022 です。
```

---

## まとめ

LLM はツール呼び出しを要求する JSON を返し、実際に実行するのはアプリ側である。このループの繰り返しがシングルエージェントだ。

## 参考

- [I think "agent" may finally have a widely enough agreed upon definition to be useful jargon now - Simon Willison](https://simonwillison.net/2025/Sep/18/agents/) — AI エージェントの定義："An LLM agent runs tools in a loop to achieve a goal."
- [The canonical agent architecture: A while loop with tools - Braintrust](https://www.braintrust.dev/blog/agent-while-loop) — Claude Code や OpenAI Agents SDK が採用する基本パターン
