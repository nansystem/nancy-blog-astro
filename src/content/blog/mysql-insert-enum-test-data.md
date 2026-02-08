---
title: MySQLでenumの値をランダムに用意してINSERTする
description: MySQLでenumのようないずれかの値を保持するフィールドにランダムな値を用意してINSERTする
date: 2021-09-22
categories:
  - mysql
permalink: /mysql-insert-enum-test-data
published: true
---


enumのような複数の値のいずれかを保持するフィールドにテストデータを用意したいので、その方法を調べた。  
  
MySQLにある`ELT`関数を使うことで簡単にテストデータを用意できる。  
ELT関数は第1引数に後続のカンマ区切りのリストの順番を入力し、第2引数以降に値を指定していく。  
  
たとえば以下のように第2引数以降に`'Aa', 'Bb', 'Cc'`を指定すると、第1引数に1を指定すると`'Aa'`、第1引数に2を指定すると`'Bb'`、第1引数に3を指定すると`'Cc'`が返ってくる。  
第1引数に存在しない順番を指定するとNULLが返ってくる。  
``` sh
SELECT ELT(1, 'Aa', 'Bb', 'Cc');
```

この`ELT`関数の第1引数を`CEIL(RAND() * リストの個数`とすることで、リストのいずれかの値をランダムに返すことができる。  

以降では実際にテーブルを作成して試してみる。  

## dockerでMySQL8.0を起動
dockerでMySQL8.0を起動する。  

``` sh
# コンテナ名は mysql-row-constructorで作成した
docker run --rm --name mysql-row-constructor -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -d mysql:8.0

# コンテナのmysqlを実行
docker exec -it mysql-row-constructor mysql
```

## テストテーブル作成
`ENUM`のあるテーブルを用意する。  

``` sql
CREATE DATABASE d1;
USE d1;
CREATE TABLE enum_tests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  size ENUM('x-small', 'small', 'medium', 'large', 'x-large')
);
```

## テストデータ作成
以下のように`'x-small', 'small', 'medium', 'large', 'x-large'`という5つのいずれか値が入りうるフィールドをもつテーブルを用意する。  
ここに`INSERT INTO テーブル名 SELECT ELT(CEIL(RAND() * リストの個数, リスト...)`とすることでテストデータを作成できる。  
データを用意したら`GROUP BY`でそれぞれの件数がランダムに用意されていることを確認できる。  
`select size, COUNT(*) from enum_tests GROUP BY size;`

``` sql
INSERT INTO enum_tests(size) SELECT ELT(CEIL(RAND() * 5), 'x-small', 'small', 'medium', 'large', 'x-large');

# fromをつければ2の倍数でテストデータが増えていく。
INSERT INTO enum_tests(size) SELECT ELT(CEIL(RAND() * 5), 'x-small', 'small', 'medium', 'large', 'x-large') from enum_tests;

# GROUP BYでデータがばらけて追加されているのを確認できる
mysql> select size, COUNT(*) from enum_tests GROUP BY size;
+---------+----------+
| size    | COUNT(*) |
+---------+----------+
| medium  |       17 |
| x-large |       13 |
| x-small |       14 |
| small   |        8 |
| large   |       12 |
+---------+----------+
5 rows in set (0.00 sec)
```

参考  
https://dev.mysql.com/doc/refman/8.0/en/string-functions.html#function_elt  

