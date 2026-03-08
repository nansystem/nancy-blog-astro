#!/bin/bash

# URL形式チェック：
# - すべて小文字であること
# - ハイフンで単語を区切ること（アンダースコアは使わない）

BLOG_DIR="src/content/blog"
VIOLATIONS=0

echo "URL形式チェック中..."
echo "================================"

while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  permalink=$(echo "$line" | grep -o 'permalink: /.*' | sed 's/permalink: //')

  # 大文字チェック
  if [[ $permalink =~ [A-Z] ]]; then
    echo "❌ $file"
    echo "   大文字が含まれています: $permalink"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi

  # アンダースコアチェック
  if [[ $permalink =~ _ ]]; then
    echo "❌ $file"
    echo "   アンダースコアが含まれています: $permalink"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi

done < <(grep -r "permalink: /" "$BLOG_DIR" --include="*.md")

echo "================================"
if [ $VIOLATIONS -eq 0 ]; then
  echo "✅ すべてのURLが正しい形式です"
  exit 0
else
  echo "❌ $VIOLATIONS 件の問題が見つかりました"
  exit 1
fi
