const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app/player.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app/player-app.js"), "utf8");

for (const key of ["gameplay", "activity", "payment", "issue"]) {
  if (!html.includes(`data-category="${key}"`)) {
    throw new Error(`missing quick category ${key}`);
  }
}

if (html.includes("data-example=")) {
  throw new Error("player quick entries should not fill random example questions directly");
}

for (const snippet of [
  "handleQuickCategory",
  "QUICK_CATEGORY_CONFIG",
  "renderSuggestionChips",
  "renderGuidedKnowledgeAnswer",
  "buildFollowUpQuestions",
  "完整牌型大小怎么排？",
]) {
  if (!js.includes(snippet)) throw new Error(`missing ${snippet}`);
}

if (js.includes("展开解释")) {
  throw new Error("knowledge answer actions should be specific follow-up questions, not generic expand actions");
}

console.log("Player quick entry smoke tests passed");
