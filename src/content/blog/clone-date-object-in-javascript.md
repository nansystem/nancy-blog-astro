---
title: JavaScriptでDateオブジェクトのクローンを作成する
description: JavaScriptでDateオブジェクトのクローンを作成する方法を2つ紹介する
date: 2022-08-10
categories:
  - JavaScript
permalink: /clone-date-object-in-javascript
published: true
---


以下のいずれかで新たなDateオブジェクトを生成できる。  
結果は同じ。  

``` js
const start = new Date()
// クローン方法1
const end = new Date(start.getTime())
// クローン方法2
const end = new Date(start.valueOf())
```

> JavaScript は valueOf メソッドを、オブジェクトをプリミティブな値に変換するときに呼び出します。あなたが自分で valueOf メソッドを実行する必要はほとんどなく、プリミティブな値が期待される場面にオブジェクトが出くわしたとき JavaScript が自動的に実行します。
https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Object/valueOf

`getTime`メソッドが、そのメソッド名から時間しか取得できないように感じるため`valueOf`メソッドの方が分かりやすいという意見もあるが、MDNいわく`valueOf`メソッドを実行する必要はほとんどないそうなので、自分は`getTime`メソッドを使うことにした。  
  
そもそもどんな時に`Date`オブジェクトをクーロンしたくなるかというと、
期間を表す開始日、終了日を表現するような、ある日付をもとに他の日付を作るときだ。  
次のように別の変数に代入しても、変数の参照先が同じために、操作していないと思っている変数にも影響が出てしまう。  

``` js
const start = new Date()
const end = start
end.setFullYear(end.getFullYear() + 1)

// "2023-08-10T08:56:10.383Z"
start.toISOString()

// "2023-08-10T08:56:10.383Z"
end.toISOString()
```

そのため、Dateオブジェクトのクローンが必要になる。  
