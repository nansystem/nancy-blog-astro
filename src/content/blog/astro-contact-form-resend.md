---
title: "Astro + Resend APIでお問い合わせフォームを自作する"
description: "Google Formのiframe埋め込みをやめて、Astroで自前のお問い合わせフォームを作りResend APIでメール通知する。ハニーポットによるスパム対策、サブドメイン運用も。"
date: 2026-02-16T12:00:00+09:00
categories:
  - Astro
permalink: /astro-contact-form-resend
published: false
---

## この記事でやること

- Google Formのiframe埋め込みを廃止し、サイトのデザインに馴染む自前のフォームを作る
- Resend APIでフォーム送信内容をメール通知する（SDKなし、`fetch`のみ）
- ハニーポットによるスパム対策
- サブドメイン運用でドメインの評判を守る

## 検証環境

- Astro 5.14
- @astrojs/cloudflare アダプター
- Resend（Freeプラン）

## なぜGoogle Formをやめたか

Google Formをiframeで埋め込むと手軽だが、いくつか不満があった。

- サイトのデザインと馴染まない
- iframeの高さ調整が面倒
- 送信後のフィードバックをカスタマイズできない

Resend APIを使えば、依存パッケージを追加せず`fetch`だけでメール送信できる。

## Resendのセットアップ

### ドメイン認証にはサブドメインを使う

Resendにドメインを登録する際、`example.com`のようなルートドメインではなく`send.example.com`のようなサブドメインを使うのが推奨されている。

理由は、万が一スパム判定を受けた場合に影響がサブドメインに限定され、ルートドメインの評判を守れるから。普段のメール送受信（`info@example.com`など）に影響しない。

Resendダッシュボードでサブドメインを追加すると、設定すべきDNSレコード（DKIM、SPF、MX）が表示される。Cloudflare等のDNS管理画面でそれらを追加し、Resend側でVerifiedになれば準備完了。

### APIキーの作成

Resendダッシュボードの API Keys ページで「Full access」権限のキーを作成する。送信専用（Sending access）のキーでも動作するが、メールのステータス確認ができないためデバッグ時に不便。

## APIエンドポイントの実装

`src/pages/api/contact.ts`を作成する。

```typescript
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const name = formData.get("name")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim() ?? "";
  const message = formData.get("message")?.toString().trim() ?? "";
  const honeypot = formData.get("_gotcha")?.toString() ?? "";

  // ハニーポット: botが自動入力したら成功を返して何もしない
  if (honeypot) {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  const errors: string[] = [];
  if (!name) errors.push("お名前を入力してください。");
  if (!email) errors.push("メールアドレスを入力してください。");
  if (!message) errors.push("お問い合わせ内容を入力してください。");

  if (errors.length > 0) {
    return new Response(JSON.stringify({ success: false, errors }), {
      status: 400,
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.RESEND_TO_EMAIL;

  if (!apiKey || !from || !to) {
    return new Response(
      JSON.stringify({
        success: false,
        errors: ["メール送信の設定が不足しています。"],
      }),
      { status: 500 },
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `お問い合わせ: ${name}`,
      text: [`お名前: ${name}`, `メールアドレス: ${email}`, "", "お問い合わせ内容:", message].join(
        "\n",
      ),
      reply_to: email,
    }),
  });

  if (!res.ok) {
    const resBody = await res.text();
    console.error("Resend API error:", res.status, resBody);
    return new Response(
      JSON.stringify({
        success: false,
        errors: ["メールの送信に失敗しました。時間をおいて再度お試しください。"],
      }),
      { status: 500 },
    );
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
```

ポイント:

- **SDKなし**: Resend公式SDKを使わず`fetch`で直接叩く。依存が増えない
- **ハニーポット**: 非表示のフィールドをbotが自動入力したら成功を返して何もしない。CAPTCHAのようなUX劣化がない
- **reply_to**: お問い合わせ者のメールアドレスを設定。通知メールからそのまま返信できる

## フォームUIの実装

`src/pages/contact.astro`を書き換える。HTMLの構造だけ示す（CSSクラスはサイトに合わせて調整）。

```html
<form id="contact-form">
  <!-- ハニーポット: 非表示にする -->
  <div style="display:none" aria-hidden="true">
    <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" />
  </div>

  <label for="name">お名前</label>
  <input type="text" id="name" name="name" required />

  <label for="email">メールアドレス</label>
  <input type="email" id="email" name="email" required />

  <label for="message">お問い合わせ内容</label>
  <textarea id="message" name="message" rows="6" required></textarea>

  <div id="form-error" hidden></div>
  <div id="form-success" hidden></div>

  <button type="submit">送信する</button>
</form>
```

送信処理はクライアントサイドJavaScriptで行う。

```typescript
const form = document.getElementById("contact-form") as HTMLFormElement;
const errorDiv = document.getElementById("form-error")!;
const successDiv = document.getElementById("form-success")!;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorDiv.hidden = true;
  successDiv.hidden = true;

  const button = form.querySelector("button[type=submit]") as HTMLButtonElement;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "送信中...";

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      body: new FormData(form),
    });
    const data = await res.json();

    if (data.success) {
      successDiv.textContent = "お問い合わせありがとうございます。";
      successDiv.hidden = false;
      form.reset();
    } else {
      errorDiv.innerHTML = (data.errors as string[]).join("<br>");
      errorDiv.hidden = false;
    }
  } catch {
    errorDiv.textContent = "送信に失敗しました。時間をおいて再度お試しください。";
    errorDiv.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
```

## 環境変数の設定

Astro + Cloudflareアダプターでは、`astro.config.mjs`の`vite.define`で環境変数をサーバーサイドコードに渡す。

```javascript
// astro.config.mjs
export default defineConfig({
  vite: {
    define: {
      "process.env.RESEND_API_KEY": JSON.stringify(process.env.RESEND_API_KEY),
      "process.env.RESEND_FROM_EMAIL": JSON.stringify(process.env.RESEND_FROM_EMAIL),
      "process.env.RESEND_TO_EMAIL": JSON.stringify(process.env.RESEND_TO_EMAIL),
    },
  },
});
```

ローカルでは`.env`や`.envrc`など任意の方法で設定する。

```bash
RESEND_API_KEY="re_xxxxxxxxx"
RESEND_FROM_EMAIL="noreply@send.example.com"
RESEND_TO_EMAIL="info@example.com"
```

本番（Cloudflare Pages）へは`wrangler`のCLIで設定する。`secret put`を使うと値は暗号化されて保存される。

```bash
npx wrangler pages secret put RESEND_API_KEY --project <your-project>
npx wrangler pages secret put RESEND_FROM_EMAIL --project <your-project>
npx wrangler pages secret put RESEND_TO_EMAIL --project <your-project>
```

## 設定中にResendが障害

ドメイン認証を終え、いざテスト送信という段階でResendの障害に遭遇した。

APIは成功レスポンス（IDつき）を返すのに、ダッシュボードにメールが表示されず、実際の配信もされない。Usage画面を見ても送信数がカウントされていない。ローカル環境の問題かと切り分けを進めたが、X（旧Twitter）でResendの障害報告を発見し原因が判明した。

APIがエラーを返さず成功レスポンスを返していたのが厄介で、切り分けに時間がかかった。外部サービスに依存する実装では、ステータスページやSNSでの障害情報も確認手段に入れておくとよい。

## まとめ

- Google Formのiframeを廃止し、AstroのAPIエンドポイント + Resend APIでお問い合わせフォームを自作した
- SDKを使わず`fetch`だけで実装。依存パッケージの追加なし
- ハニーポットでスパム対策、サブドメイン運用でドメインの評判を保護
- 外部サービスの障害時はAPIレスポンスだけでなく、ステータスページやSNSも確認する
