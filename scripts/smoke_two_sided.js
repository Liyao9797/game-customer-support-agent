global.localStorage = {
  store: new Map(),
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  },
  setItem(key, value) {
    this.store.set(key, String(value));
  },
  removeItem(key) {
    this.store.delete(key);
  },
};

const AgentCore = require("../app/agent-core.js");
const FeedbackStore = require("../app/feedback-store.js");
const rules = require("../data/agent/intent_rules_day1.json");

const question = "新手赛事奖励没到账";
const route = AgentCore.classifyMessage(question, rules);
const draft = AgentCore.createFeedbackDraft(question, route);
draft.emotion = route.emotion;

const feedback = AgentCore.submitFeedback(draft, FeedbackStore.nextSerial(), new Date("2026-05-28T16:00:00+08:00"));
FeedbackStore.addFeedback(feedback);

const stored = FeedbackStore.findFeedback(feedback.feedback_id);
if (!stored) throw new Error("player submit did not create shared feedback");
if (stored.issue.category !== "活动奖励") throw new Error("wrong feedback category");

FeedbackStore.updateFeedback(stored.feedback_id, (item) =>
  AgentCore.transitionFeedbackStatus(item, "triaged", "", new Date("2026-05-28T16:05:00+08:00")),
);
FeedbackStore.updateFeedback(stored.feedback_id, (item) =>
  AgentCore.transitionFeedbackStatus(item, "processing", "", new Date("2026-05-28T16:10:00+08:00")),
);

const updated = FeedbackStore.findFeedback(stored.feedback_id);
if (updated.status !== "processing") throw new Error("ops status transition did not persist");
if ((updated.timeline || []).length !== 3) throw new Error("timeline was not updated");

const queryRoute = AgentCore.classifyMessage(`${stored.feedback_id} 处理到哪了`, rules);
if (queryRoute.next_action !== "check_feedback_status") throw new Error("player progress query route failed");

console.log("Two-sided smoke tests passed");
