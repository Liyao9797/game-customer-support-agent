const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const forbiddenFiles = [
  "data/ocr/rapidocr_full.csv",
  "data/ocr/rapidocr_full.md",
  "data/ocr/rapidocr_full_qc.csv",
  "data/ocr/rapidocr_full_review.md",
  "data/ocr/rapidocr_sample.csv",
  "data/ocr/rapidocr_sample.md",
];

const forbiddenPathFragments = ["docs/screenshot_groups/"];

const ignoredDirs = new Set([".git", ".venv", "node_modules", "__pycache__"]);
const ignoredFiles = new Set(["docs/UX_ISSUE_TRACKER.xlsx", "scripts/check_public_release.js"]);

const forbiddenText = [
  { label: "absolute local path", pattern: /\/Users\/|yyld|file:\/\// },
  { label: "source project folder name", pattern: /游戏客服agent/ },
  { label: "original game brand", pattern: /途游|TUYOU|tuyou/ },
  { label: "specific game/product names", pattern: /经典斗地主|连炸斗地主|不洗牌斗地主|暗牌斗地主|黄金暗牌|飚得快|经典掼蛋|新星赛|钓鱼挑战/ },
  { label: "raw OCR screenshot ids", pattern: /IMG_[0-9]+(?:\.PNG)?/ },
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(root, fullPath);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) return [];
      return walk(fullPath);
    }
    if (ignoredFiles.has(relPath)) return [];
    return [relPath];
  });
}

const failures = [];

for (const relPath of forbiddenFiles) {
  if (fs.existsSync(path.join(root, relPath))) {
    failures.push(`Forbidden raw data file is still present: ${relPath}`);
  }
}

for (const relPath of walk(root)) {
  for (const fragment of forbiddenPathFragments) {
    if (relPath.includes(fragment)) {
      failures.push(`Forbidden detailed screenshot grouping file is still present: ${relPath}`);
    }
  }

  const fullPath = path.join(root, relPath);
  const buffer = fs.readFileSync(fullPath);
  if (buffer.includes(0)) continue;

  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/);
  for (const { label, pattern } of forbiddenText) {
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        failures.push(`${relPath}:${index + 1} contains ${label}: ${line.trim()}`);
      }
    });
  }
}

if (failures.length) {
  console.error("Public release check failed:");
  for (const failure of failures.slice(0, 80)) {
    console.error(`- ${failure}`);
  }
  if (failures.length > 80) {
    console.error(`- ...and ${failures.length - 80} more`);
  }
  process.exit(1);
}

console.log("Public release check passed");
