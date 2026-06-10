const fs = require("fs");
const AgentCore = require("../app/agent-core.js");

const rules = JSON.parse(fs.readFileSync("./data/agent/intent_rules_day1.json", "utf8"));

const paymentRoute = AgentCore.classifyMessage("我充值了30元没到账", rules);
const paymentDraft = AgentCore.createFeedbackDraft("我充值了30元没到账", paymentRoute);

if (paymentDraft.missing_fields.includes("amount")) {
  throw new Error("payment draft should not ask amount again when 30元 is already recognized");
}
if (paymentDraft.collected_fields.amount !== 30) {
  throw new Error(`payment amount should be prefilled as 30, got ${paymentDraft.collected_fields.amount}`);
}

const assetRoute = AgentCore.classifyMessage("我的金币少了10w", rules);
const assetDraft = AgentCore.createFeedbackDraft("我的金币少了10w", assetRoute);

if (assetDraft.missing_fields.includes("asset_type")) {
  throw new Error("asset draft should not ask asset_type again when 金币 is already recognized");
}
if (assetDraft.missing_fields.includes("asset_change")) {
  throw new Error("asset draft should not ask asset_change again when 10w is already recognized");
}
if (assetDraft.collected_fields.asset_type !== "游戏内金币") {
  throw new Error(`asset_type should be prefilled as 游戏内金币, got ${assetDraft.collected_fields.asset_type}`);
}
if (assetDraft.collected_fields.asset_change !== "少了 100000 游戏内金币") {
  throw new Error(`asset_change should describe lost coins, got ${assetDraft.collected_fields.asset_change}`);
}

const mixedAssetRoute = AgentCore.classifyMessage("用钻石买金币失败了，钻石扣了金币没给", rules);
const mixedAssetDraft = AgentCore.createFeedbackDraft("用钻石买金币失败了，钻石扣了金币没给", mixedAssetRoute);

if (mixedAssetDraft.missing_fields.includes("asset_type")) {
  throw new Error("mixed asset draft should prefill asset_type for 钻石/金币");
}
if (mixedAssetDraft.missing_fields.includes("game_mode_or_scene")) {
  throw new Error("mixed asset draft should prefill scene for diamond_to_coin context");
}

console.log("Feedback field prefill smoke tests passed");
