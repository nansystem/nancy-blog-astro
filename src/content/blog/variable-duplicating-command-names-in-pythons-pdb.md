---
title: Pythonのpdbで変数名がコマンド名と被った時の対処
description: Pythonのpdbでデバッグし、コード内のuやlなどの変数名を参照できるようにする方法を解説する
date: 2022-07-26
categories:
  - Python
permalink: /variable-duplicating-command-names-in-pythons-pdb
published: true
---

pdbのコマンド名と同名の変数、たとえば`u`や`l`をコマンドラインで入力しても、変数の中身が確認できない。  
pdbのコマンドと認識されるためである。  
その場合、`!`を変数名の前につけるか、`p 変数名`とすれば参照できるようになる。

たとえば、以下のようなユーザーIDを元にユーザーを取得するコードがあったとする。  
デバッグしたい位置に`breakpoint()`と記載する。Python3.7より前なら`import pdb; pdb.set_trace()`とする。

sample.py

```python
from typing import Optional

class User:
    id: int
    name: str

    def __init__(self, id: int, name: str):
        self.id = id
        self.name = name

def get_user(id: int) -> Optional[User]:
    ul = [User(1, "sato"), User(2, "yamada")]
    u =  next((u for u in ul if u.id == id), None)
    # import pdb; pdb.set_trace()
    breakpoint()
    return u

get_user(2)
```

ファイルを実行する。

```bash
python sample.py
```

すると以下のようなコマンドラインの先頭に`(Pdb)`と表示される画面になる。  
ここで`u`と入力するとpdbのコマンドと認識され変数の内容を確認できない。  
そこで!uと変数名の前に!をつければよい。  
あるいはp(printの略) uとする。  
なお、クラスのフィールド値を参照したい場合は、`__dict__`で確認できる。

```bash
-> return u
(Pdb) !u
<__main__.User object at 0x7fbf48db6490>

(Pdb) p u
<__main__.User object at 0x7f70a75ec490>

(Pdb) p u.__dict__
{'id': 2, 'name': 'yamada'}
```

pdbの拡張として`ipdb`というモジュールがある。  
`ipdb`は表示をカラフルにし、変数の候補を表示してくれる。  
こちらを使う場合は別途インストールが必要である。

```bash
pip install ipdb
```

`breakpoint()`はデフォルトで`pdb`を使うので、`ipdb`を使いたい場合は以下の環境変数を設定する。

```bash
export PYTHONBREAKPOINT=ipdb.set_trace
```

`p`と入力し`tab`を入力すると、`p`を先頭にしたコマンドの候補が表示される。  
多少デバッグが捗るかもしれない。

```bash
ipdb> p
         pass       %paste     %pdoc      pinfo2     %precision
         pow()      %pastebin  %%perl     %pinfo2    %prun
         print      %pdb       pfile      %pip       %%prun
         property   pdef       %pfile     %popd      %psearch   >
         p          %pdef      pinfo      pp         psource
         %page      pdoc       %pinfo     %pprint    %psource
```
