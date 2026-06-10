const fs = require("fs");
const AgentCore = require("../app/agent-core.js");

const rules = JSON.parse(fs.readFileSync("./data/agent/intent_rules_day1.json", "utf8"));

function makeDraft(text) {
  const route = AgentCore.classifyMessage(text, rules);
  return AgentCore.createFeedbackDraft(text, route);
}

function assertPrefilled(draft, field, expected) {
  if (draft.missing_fields.includes(field)) {
    throw new Error(`${draft.raw_question} should not ask ${field} again`);
  }
  if (draft.collected_fields[field] !== expected) {
    throw new Error(`${field} should be ${expected}, got ${draft.collected_fields[field]}`);
  }
}

const paymentDraft = makeDraft("我昨天微信充了30元买礼包没到账");
assertPrefilled(paymentDraft, "amount", 30);
assertPrefilled(paymentDraft, "payment_time", "昨天");
assertPrefilled(paymentDraft, "payment_channel", "微信支付");
assertPrefilled(paymentDraft, "item", "礼包");

const rewardDraft = makeDraft("新手赛事昨晚8点完成了，称号没发");
assertPrefilled(rewardDraft, "activity_name", "新手赛事");
assertPrefilled(rewardDraft, "completed_at", "昨晚8点");
assertPrefilled(rewardDraft, "expected_reward", "称号奖励");

const bugDraft = makeDraft("三人牌局刚刚卡死了，牌局ID 123456，有截图");
assertPrefilled(bugDraft, "occurred_at", "刚刚");
assertPrefilled(bugDraft, "game_mode", "三人牌局");
assertPrefilled(bugDraft, "table_or_round_id", "123456");
assertPrefilled(bugDraft, "screenshot_or_video", "有截图");

const assetDraft = makeDraft("用钻石买金币失败了，刚刚发生的，有截图");
assertPrefilled(assetDraft, "game_mode_or_scene", "钻石购买金币");
assertPrefilled(assetDraft, "occurred_at", "刚刚");
assertPrefilled(assetDraft, "screenshot_or_video", "有截图");

console.log("More feedback field prefill smoke tests passed");
