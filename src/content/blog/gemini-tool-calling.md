---
title: AIオーケストレーションを理解したい（1）シングルエージェントを自作する
description: マルチエージェントの協調動作を理解するための第一歩として、シングルエージェントをゼロから自作する。CLI・Gemini API呼び出し・自作ツール・ループ実行の4ステップで、Tool Callingの仕組みを手を動かしながら腹落ちさせる。
date: 2026-02-23
categories:
  - AI
permalink: /ai-orchestration-1-single-agent
published: false
---

マルチエージェントが協調して動く AI オーケストレーションツールに興味がある。ただ、その仕組みを理解しようとしたとき、まずシングルエージェントが何をしているのかが腹落ちしていないと先に進めないと感じた。

この記事では、シングルエージェントの中心となる Tool Calling を4つのステップでゼロから自作する。

## 前提: LLM はローカルにアクセスできない

Gemini はテキストを生成するモデルであり、Google のサーバー上で動いている。あなたの PC のファイルを読む手段を持っていない。「ファイルを読んで」と伝えたとき、Gemini がやることはファイルを読むことではなく、「read_file を呼びたい」という JSON を返すだけだ。

実際にファイルを読むのはアプリ側（Node.js 等）であり、Gemini はその結果を受け取って回答を生成する。この役割分担が Tool Calling の仕組みを端的に表している。

では Claude Code や Gemini CLI はなぜローカルのファイルを読めるのか。答えは「CLI 自身がこのアプリ側の実装を持っているから」だ。LLM から「read_file を呼びたい」が返ってきたとき、CLI がローカルでファイルを読んで結果を LLM に渡している。この記事で自作するのは、まさにその実行層だ。

---

## Step 1: CLI で入力を受け取り返す

まず AI とは無関係に、標準入力を受け取って返すだけの CLI を作る。これが後のステップで使うループの土台になる。

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

実行するとこうなる。

```
$ pnpm run step1
Type something (type "exit" to quit):
You: こんにちは
Echo: こんにちは
You: ありがとう
Echo: ありがとう
```

---

## Step 2: Gemini API をシンプルに呼び出す

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

レスポンスには2種類のフィールドがある。

| フィールド      | 内容                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `text`          | Gemini のテキスト回答                                                |
| `functionCalls` | 呼び出したいツールの一覧（ツールを渡していないので常に `undefined`） |

`ai.chats.create()` でチャットセッションを開始すると、会話履歴が SDK 内部で保持される。毎回の `sendMessage` で履歴が積み重なっていく。

---

## Step 3: 自作ツールを渡す

ここが重要な点だ。Gemini にツールの「仕様書」を渡すと、必要なタイミングで `functionCalls` が返ってくる。アプリ側でそれを実行して結果を返す。Step 4 のループへ進む前に、まず1往復だけ試して `functionCalls` が返ることを確認する。

```ts
import "dotenv/config";
import { GoogleGenAI, Type, createPartFromFunctionResponse } from "@google/genai";
import * as fs from "node:fs/promises";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Gemini に渡す「仕様書」
// execute は Gemini には渡されない。アプリ側だけが持つ。
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

Gemini は `execute` の中身を知らない。`description` を読んで「このツールを呼べばファイルを読める」と判断するだけだ。**AI にはツールが実際に何をするかは見えない。`description` を信じるだけ**なので、description に嘘を書かないことがツール設計の基本になる。

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
console.log(finalResponse.text); // "package.json の name は gemini-tool-calling です"
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
----------------

→ Gemini が "read_file" を呼びたがっている
  args: {"path":"package.json"}
  実行結果（先頭100文字）: {
  "name": "gemini-tool-calling",
  ...

Gemini: The value of the name field in package.json is "gemini-tool-calling".
```

1 回目のレスポンスは `text: undefined` で `functionCalls` だけが返ってきた。アプリ側でファイルを読んで結果を渡すと、2 回目のレスポンスで最終回答が返ってきた。

---

## Step 4: ループで実行する

Step 3 では1往復だけだった。実際には Gemini が複数回ツールを呼び出すことがある。`functionCalls` が返ってくる間はループを続け、`text` が返ってきたら終了する。

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
Gemini + read_file tool (type "exit" to quit):
You: package.json と tsconfig.json を読んで、それぞれの name と compilerOptions.target を教えて
  [tool] read_file, read_file を実行中...
Gemini: package.json の name は gemini-tool-calling で、tsconfig.json の compilerOptions.target は ES2022 です。
```

---

## まとめ

| ステップ | 学んだこと                                                                       |
| -------- | -------------------------------------------------------------------------------- |
| Step 1   | readline で CLI の対話ループを作る                                               |
| Step 2   | Gemini のレスポンスは `text` と `functionCalls` の2種類                          |
| Step 3   | ローカルのファイル操作には自作ツールが必要。Gemini は `description` を信じるだけ |
| Step 4   | `functionCalls` がなくなるまでループし、最終的に1つの `text` になる              |

**「LLM が JSON を返すだけ、動かすのはアプリ側」** — これが Tool Calling の役割分担だ。この仕組みは Gemini に限らず OpenAI・Claude でも同じで、Claude Code や Gemini CLI もこの構造をローカルに実装したものだ。
