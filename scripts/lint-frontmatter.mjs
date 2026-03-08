// frontmatter の表記ゆれを prh.yml のルールで検出するスクリプト。
// textlint は frontmatter を lint しないため、このスクリプトで補完する。
//
// 使い方:
//   node scripts/lint-frontmatter.mjs              # チェックのみ
//   node scripts/lint-frontmatter.mjs --fix        # 自動修正

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { load as parseYaml } from 'js-yaml';

const FIX_MODE = process.argv.includes('--fix');
const BLOG_DIR = 'src/content/blog';
const PRH_FILE = 'prh.yml';

// prh.yml からルールを読み込む
function loadPrhRules(prhPath) {
  const content = readFileSync(prhPath, 'utf-8');
  const parsed = parseYaml(content);
  const rules = [];
  for (const rule of parsed.rules ?? []) {
    if (!rule.expected || !rule.patterns) continue;
    for (const pattern of rule.patterns) {
      rules.push({ pattern: String(pattern), expected: String(rule.expected) });
    }
  }
  return rules;
}

// ファイル一覧を再帰的に取得
function getMdFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...getMdFiles(fullPath));
    } else if (extname(entry) === '.md' || extname(entry) === '.mdx') {
      files.push(fullPath);
    }
  }
  return files;
}

// frontmatter ブロックを抽出
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? { raw: match[0], body: match[1], end: match[0].length } : null;
}

const rules = loadPrhRules(PRH_FILE);
const files = getMdFiles(BLOG_DIR);

let totalErrors = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const fm = extractFrontmatter(content);
  if (!fm) continue;

  let fixedFm = fm.raw;
  const errors = [];

  for (const { pattern, expected } of rules) {
    if (fm.raw.includes(pattern)) {
      errors.push({ pattern, expected });
      fixedFm = fixedFm.replaceAll(pattern, expected);
    }
  }

  if (errors.length === 0) continue;

  totalErrors += errors.length;
  console.log(`\n${file}`);
  for (const { pattern, expected } of errors) {
    console.log(`  "${pattern}" => "${expected}"`);
  }

  if (FIX_MODE) {
    writeFileSync(file, fixedFm + content.slice(fm.end), 'utf-8');
    console.log('  → 修正しました');
  }
}

if (totalErrors === 0) {
  console.log('frontmatter に表記ゆれはありませんでした。');
} else if (!FIX_MODE) {
  console.log(`\n合計 ${totalErrors} 件の表記ゆれが見つかりました。`);
  console.log('--fix オプションで自動修正できます。');
  process.exit(1);
} else {
  console.log(`\n合計 ${totalErrors} 件を修正しました。`);
}
