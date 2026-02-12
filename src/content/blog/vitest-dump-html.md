---
title: "Vitestのテストコードからレンダリング結果のHTMLを出力する"
description: "Testing Libraryのrender関数で得られるcontainer.innerHTMLをconsole.logで出力し、Reactコンポーネントが実際に生成するHTMLを確認する方法。"
date: 2026-02-11T13:00:00+09:00
categories:
  - JavaScript
permalink: /vitest-dump-html
published: false
---

## この記事でやること

Reactコンポーネントが実際にどんなHTMLを生成するのか確認したいことがある。ブラウザのDevToolsで見る方法もあるが、テストコードから出力できると手軽だ。

Vitest + Testing Libraryの環境では、`render()` が返す `container.innerHTML` を `console.log` するだけでHTMLが得られる。

## 手順

### 1. テストファイルを作成する

確認したいコンポーネントを `render()` し、`container.innerHTML` を出力する。

```tsx
import { render } from "@testing-library/react";
import { it } from "vitest";
import { MyComponent } from "./my-component";

it("HTMLを出力する", () => {
  const { container } = render(<MyComponent />);
  console.log(container.innerHTML);
});
```

### 2. テストを実行する

```bash
npx vitest run src/dump-html.test.tsx
```

stdoutにHTMLが出力される。

```
stdout | src/dump-html.test.tsx > HTMLを出力する
<form id="signup" novalidate=""><div><label for="signup-email">メールアドレス</label><input required="" id="signup-email" form="signup" type="email" name="email"></div></form>
```

### 3. 整形する

出力は1行のHTMLになるので、読みやすくしたい場合はフォーマッタに通す。VS Codeなら出力をHTMLファイルに貼り付けてフォーマットすればよい。

## propsを変えて複数パターン出力する

1つのテストファイルに複数のケースを書けば、propsごとの出力を一度に確認できる。

```tsx
import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { ContactForm } from "./contact-form";

describe("HTML dump", () => {
  it("エラーなし", () => {
    const { container } = render(<ContactForm />);
    console.log("=== エラーなし ===");
    console.log(container.innerHTML);
  });

  it("フィールドエラーあり", () => {
    const lastResult = {
      status: "error" as const,
      initialValue: { name: "", email: "" },
      error: { email: ["メールアドレスは必須です"] },
    };
    const { container } = render(<ContactForm lastResult={lastResult} />);
    console.log("=== フィールドエラーあり ===");
    console.log(container.innerHTML);
  });
});
```

```bash
npx vitest run src/dump-html.test.tsx
```

ケースごとに `===` の区切りが出力されるので、どのパターンがどのHTMLかすぐわかる。

## 注意点

- `container.innerHTML` はjsdomが生成したHTMLなので、ブラウザのレンダリング結果と完全に同一ではない。属性の順序がブラウザと異なる場合がある
- テストの目的はHTMLの確認なので、アサーション（`expect`）は不要。確認が終わったらファイルごと削除する
- `screen.debug()` でも出力できるが、文字数の上限がありHTMLが途中で切れることがある。`container.innerHTML` のほうが確実
