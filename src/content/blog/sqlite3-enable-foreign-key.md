---
title: sqlite3で外部キー制約を常に有効にする
description: sqlite3で外部キー制約を常に有効にするには.sqlitercにPRAGMA foreign_keys = ON;と書く
date: 2022-03-04
categories:
  - sqlite3
permalink: /sqlite3-enable-foreign-key
published: true
---


sqlite3で外部キー制約を設定したテーブルの行を削除しようとした。  
制約があるために削除されないことを期待したが、削除されてしまった。  
sqlite3では、テーブルに制約を課していても、sqlite3の設定を有効にしないといけないらしい。 そのためのコマンドが以下である。  

``` sql
PRAGMA foreign_keys = ON;
```

ところが、この設定は`sqlite3`コマンドでターミナルに入るたびに設定しないといけない。  
設定し忘れる。  
sqlite3はデフォルトの設定を変えることができる。  

`man sqlite3`の説明のとおり、ホームディレクトリに`.sqliterc`という名前のファイルを作ればよい。

> If  the  file  ~/.sqliterc  exists,  it is processed first.  can be found in the user's home directory, it is read and processed.

`~/.sqliterc`  
``` sh
PRAGMA foreign_keys = ON;
```

これでsqlite3の外部キー制約を常に有効にできる。  
なお、外部キー制約とは関係ないが、他にもSQLを読みやすくする設定がある。  

`~/.sqliterc`
``` sh
-- 外部キー制約を有効にする
PRAGMA foreign_keys = ON;

-- SQLの実行結果にカラム名をつける
.headers on

-- カラム名の下に値が配置される
.mode column

-- SQLの実行時間を表示する
.timer on

-- 変更の影響を受けた行を表示する
.changes on
```
