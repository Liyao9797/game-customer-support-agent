const fs = require("fs");
const path = require("path");
const AgentCore = require("../app/agent-core.js");

const root = path.resolve(__dirname, "..");
const kb = JSON.parse(fs.readFileSync(path.join(root, "data/knowledge_base/card_game_kb_seed.json"), "utf8"));
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/agent/intent_rules_day1.json"), "utf8"));

const cases = [
  ["黄金牌活动飞机能压三带吗？", "answer_from_kb", "玩法规则", "KB-CARD-20260527-0004"],
  ["连续挑战活动鱼票会清空吗？", "answer_from_kb", "活动规则", "KB-CARD-20260527-0007"],
  ["我充值了30元没到账我要投诉12315", "ask_clarification", "支付充值", null],
  ["新手赛事奖励没到账", "ask_clarification", "活动奖励", null],
  ["FB202605270001 处理到哪了", "check_feedback_status", "进度查询", null],
];

for (const [question, expectedAction, expectedCategory, expectedKb] of cases) {
  const route = AgentCore.classifyMessage(question, rules);
  if (route.next_action !== expectedAction) {
    throw new Error(`${question} expected ${expectedAction}, got ${route.next_action}`);
  }
  if (route.category !== expectedCategory) {
    throw new Error(`${question} expected ${expectedCategory}, got ${route.category}`);
  }
  if (expectedKb) {
    const [match] = AgentCore.retrieveKnowledge(question, kb);
    if (!match || match.item.knowledge_id !== expectedKb) {
      throw new Error(`${question} expected ${expectedKb}, got ${match?.item?.knowledge_id || "none"}`);
    }
  }
}

console.log("Agent smoke tests passed");
