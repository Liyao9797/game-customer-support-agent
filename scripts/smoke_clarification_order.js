const fs = require("fs");
const AgentCore = require("../app/agent-core.js");

const rules = JSON.parse(fs.readFileSync("./data/agent/intent_rules_day1.json", "utf8"));

const cases = [
  {
    text: "我充值了30元没到账",
    expectedCategory: "支付充值",
    expectedOrder: ["uid", "amount", "payment_time", "payment_channel", "item", "order_id_or_screenshot"],
  },
  {
    text: "我的金币少了10w",
    expectedCategory: "资产道具",
    expectedOrder: ["uid", "asset_type", "asset_change", "game_mode_or_scene", "occurred_at", "screenshot_or_video"],
  },
  {
    text: "新手赛事奖励没到账",
    expectedCategory: "活动奖励",
    expectedOrder: ["uid", "activity_name", "completed_at", "expected_reward", "screenshot"],
  },
  {
    text: "对局卡死了",
    expectedCategory: "游戏 BUG",
    expectedOrder: ["uid", "occurred_at", "game_mode", "table_or_round_id", "app_version", "device", "os", "screenshot_or_video"],
  },
];

for (const item of cases) {
  const route = AgentCore.classifyMessage(item.text, rules);
  if (route.category !== item.expectedCategory) {
    throw new Error(`${item.text} expected ${item.expectedCategory}, got ${route.category}`);
  }
  const actual = route.required_fields || [];
  if (actual.join("|") !== item.expectedOrder.join("|")) {
    throw new Error(`${item.text} expected order ${item.expectedOrder.join(",")}, got ${actual.join(",")}`);
  }
}

console.log("Clarification order smoke tests passed");
