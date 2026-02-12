---
title: "Reactのuncontrolledフォームは入力しても再レンダリングが走らないことをVitestで確認する"
description: "Reactのcontrolled/uncontrolledパターンの違いを、Vitestのレンダリング回数カウントで実証する。uncontrolledではユーザー入力で再レンダリングが走らず、DOMが値を保持する。"
date: 2026-02-11T14:00:00+09:00
categories:
  - React
permalink: /react-uncontrolled-rerender
published: false
---

## この記事でやること

Reactのフォームには、`value` と `onChange` で毎回の入力をstateに同期する[controlled](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable)パターンと、`defaultValue` で初期値だけ渡して以降はDOMが値を保持するuncontrolledパターンがある。

「uncontrolledは再レンダリングが走らない」とよく言われるが、実際にテストコードで確認してみる。

## 検証環境

```bash
npm create vite@latest uncontrolled-verify -- --template react-ts
cd uncontrolled-verify
npm install
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

`vitest.config.ts` を作成する。

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test-setup.ts",
  },
});
```

```ts
// src/test-setup.ts
import "@testing-library/jest-dom/vitest";
```

## uncontrolledコンポーネント

`defaultValue` で初期値を渡すだけで、`onChange` でstateを更新しない。

```tsx
// src/components/uncontrolled-form.tsx
export function UncontrolledForm() {
  return (
    <form>
      <label htmlFor="username">ユーザー名</label>
      <input id="username" type="text" defaultValue="ゲスト" />
    </form>
  );
}
```

## テスト — 入力しても再レンダリングが走らないことを確認する

ラッパーコンポーネントで `vi.fn()` を呼び、レンダリング回数をカウントする。

```tsx
// src/components/uncontrolled-form.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UncontrolledForm } from "./uncontrolled-form";

describe("uncontrolledフォームの再レンダリング", () => {
  it("入力してもReactの再レンダリングが走らない", async () => {
    const user = userEvent.setup();
    const renderCount = vi.fn();

    function Wrapper() {
      renderCount();
      return <UncontrolledForm />;
    }

    render(<Wrapper />);

    const initialRenderCount = renderCount.mock.calls.length;

    const input = screen.getByLabelText("ユーザー名");
    await user.clear(input);
    await user.type(input, "太郎");

    // 再レンダリングは増えない
    expect(renderCount.mock.calls.length).toBe(initialRenderCount);
    // しかしDOMの値は更新されている
    expect(input).toHaveValue("太郎");
  });
});
```

### 結果

| タイミング         | レンダリング回数 | DOMの値    |
| ------------------ | ---------------- | ---------- |
| 初回レンダリング後 | 1                | `"ゲスト"` |
| `"太郎"` と入力後  | 1（増えない）    | `"太郎"`   |

uncontrolledでは `useState` を使っていないので、入力によるstate変更が発生せず、再レンダリングが走らない。DOMが値を直接保持している。

## 比較 — controlledだとどうなるか

```tsx
// src/components/controlled-form.tsx
import { useState } from "react";

export function ControlledForm() {
  const [username, setUsername] = useState("ゲスト");

  return (
    <form>
      <label htmlFor="username">ユーザー名</label>
      <input
        id="username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
    </form>
  );
}
```

controlledの場合、`"太郎"` と2文字入力すると `onChange` → `setUsername` が2回呼ばれ、再レンダリングも2回走る。フォームのフィールド数が多い場合、この差が効いてくる。
