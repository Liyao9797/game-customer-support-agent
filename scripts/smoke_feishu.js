const AgentCore = require("../app/agent-core.js");
const FeishuAdapter = require("../app/feishu-adapter.js");
const rules = require("../data/agent/intent_rules_day1.json");

async function main() {
  const route = AgentCore.classifyMessage("新手赛事奖励没到账", rules);
  const draft = AgentCore.createFeedbackDraft("新手赛事奖励没到账", route);
  draft.emotion = route.emotion;
  const feedback = AgentCore.submitFeedback(draft, 1, new Date("2026-05-28T14:00:00+08:00"));
  const row = FeishuAdapter.mapFeedbackToFeishuRow(feedback);

  if (row.feedback_id !== "FB202605280001") throw new Error("feedback_id mapping failed");
  if (row.category !== "活动奖励") throw new Error("category mapping failed");
  if (!row.timeline.includes("submitted")) throw new Error("timeline mapping failed");

  const result = await FeishuAdapter.syncFeedback(feedback, { delayMs: 1 });
  const synced = FeishuAdapter.buildSyncRecord(feedback, result, new Date("2026-05-28T14:01:00+08:00"));
  if (!synced.collaboration.feishu_doc_synced) throw new Error("sync flag failed");
  if (synced.collaboration.sync_status !== "success") throw new Error("sync status failed");

  const fail = await FeishuAdapter.syncFeedback(feedback, { delayMs: 1, forceFail: true });
  const failed = FeishuAdapter.buildSyncRecord(feedback, fail, new Date("2026-05-28T14:02:00+08:00"));
  if (failed.collaboration.sync_retry_count !== 1) throw new Error("retry count failed");
  if (failed.collaboration.sync_status !== "failed") throw new Error("failed status failed");

  console.log("Feishu mock smoke tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
