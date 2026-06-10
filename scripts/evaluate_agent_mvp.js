const fs = require("fs");
const path = require("path");
const AgentCore = require("../app/agent-core.js");

const root = path.resolve(__dirname, "..");
const kb = JSON.parse(fs.readFileSync(path.join(root, "data/knowledge_base/card_game_kb_seed.json"), "utf8"));
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/agent/intent_rules_day1.json"), "utf8"));

const cases = [
  {
    id: "EV-001",
    text: "王炸和炸弹谁大？",
    type: "knowledge",
    expectedCategory: "玩法规则",
    answerKeywords: ["王炸", "炸弹"],
  },
  {
    id: "EV-002",
    text: "暗牌玩法几张算炸弹？",
    type: "knowledge",
    expectedCategory: "玩法规则",
    answerKeywords: ["三张", "炸弹"],
  },
  {
    id: "EV-003",
    text: "黄金牌活动飞机能压三带吗？",
    type: "knowledge",
    expectedCategory: "玩法规则",
    answerKeywords: ["飞机", "三带"],
  },
  {
    id: "EV-006",
    text: "连续挑战活动鱼票活动结束会清空吗？",
    type: "knowledge",
    expectedCategory: "活动规则",
    answerKeywords: ["不会", "鱼票"],
  },
  {
    id: "EV-009",
    text: "我充值了 30 元没到账",
    type: "feedback",
    expectedCategory: "支付充值",
    expectedPriority: "P0",
    missingFields: ["uid", "payment_time", "payment_channel", "item", "order_id_or_screenshot"],
    collectedFields: { amount: 30 },
  },
  {
    id: "EV-010",
    text: "充值没到账我要投诉 12315",
    type: "feedback",
    expectedCategory: "支付充值",
    expectedPriority: "P0",
    expectedRiskFlags: ["public_complaint"],
  },
  {
    id: "EV-011",
    text: "新手赛事奖励没到账",
    type: "feedback",
    expectedCategory: "活动奖励",
    expectedPriority: "P1",
    missingFields: ["uid", "completed_at", "expected_reward", "screenshot"],
    collectedFields: { activity_name: "新手赛事" },
  },
  {
    id: "EV-012",
    text: "对局卡死了",
    type: "feedback",
    expectedCategory: "游戏 BUG",
    missingFields: ["uid", "occurred_at", "game_mode", "table_or_round_id", "app_version", "device", "os", "screenshot_or_video"],
  },
  {
    id: "EV-013",
    text: "有人开挂还骂人",
    type: "feedback",
    expectedCategory: "举报投诉",
    missingFields: ["reported_user", "table_or_round_id", "occurred_at", "report_reason", "evidence"],
  },
  {
    id: "EV-014",
    text: "匹配太慢了，希望优化",
    type: "feedback",
    expectedCategory: "体验建议",
    missingFields: ["module", "current_problem", "expected_improvement", "frequency"],
  },
  {
    id: "EV-015",
    text: "我的欢乐豆没了",
    type: "feedback",
    expectedCategory: "资产道具",
    collectedFields: { asset_type: "游戏内金币" },
  },
  {
    id: "EV-017",
    text: "钱没了",
    type: "unclear",
    expectedClarificationKeywords: ["人民币", "金币", "钻石"],
  },
  {
    id: "EV-018",
    text: "金币少了，这局赢了没加",
    type: "feedback",
    expectedCategory: "资产道具",
    expectedSubCategory: "结算后资产异常",
  },
  {
    id: "EV-019",
    text: "气死了，我充值 30 元没到账",
    type: "feedback",
    expectedCategory: "支付充值",
    expectedEmotion: "明显负面",
  },
  {
    id: "EV-020",
    text: "你们这游戏太坑了，奖励又没发",
    type: "feedback",
    expectedCategory: "活动奖励",
    expectedEmotion: "明显负面",
  },
  {
    id: "EV-021",
    text: "一直卡死，烦死了",
    type: "feedback",
    expectedCategory: "游戏 BUG",
    expectedEmotion: "明显负面",
  },
  {
    id: "EV-022",
    text: "FB202605280001 处理到哪了",
    type: "status",
  },
  {
    id: "EV-023",
    text: "查一下我的反馈",
    type: "status_clarify",
  },
];

const results = [];

for (const item of cases) {
  try {
    evaluateCase(item);
    results.push({ id: item.id, status: "PASS", text: item.text });
  } catch (error) {
    results.push({ id: item.id, status: "FAIL", text: item.text, error: error.message });
  }
}

const passed = results.filter((item) => item.status === "PASS").length;
const failed = results.length - passed;

for (const item of results) {
  if (item.status === "PASS") {
    console.log(`PASS ${item.id} ${item.text}`);
  } else {
    console.log(`FAIL ${item.id} ${item.text} :: ${item.error}`);
  }
}

console.log(`\nAgent MVP evaluation: ${passed}/${results.length} passed`);

if (failed > 0) {
  process.exitCode = 1;
}

function evaluateCase(item) {
  const route = AgentCore.classifyMessage(item.text, rules);
  if (item.type === "knowledge") {
    expect(route.next_action, "answer_from_kb", item, "next_action");
    expect(route.category, item.expectedCategory, item, "category");
    const answer = AgentCore.buildKnowledgeAnswer(item.text, route, AgentCore.retrieveKnowledge(item.text, kb));
    for (const keyword of item.answerKeywords || []) {
      if (!answer.content.includes(keyword)) {
        throw new Error(`answer should include ${keyword}`);
      }
    }
    return;
  }

  if (item.type === "unclear") {
    expect(route.intent, "unclear", item, "intent");
    const clarification = AgentCore.buildFallbackClarification(item.text, route);
    for (const keyword of item.expectedClarificationKeywords || []) {
      if (!clarification.includes(keyword)) {
        throw new Error(`clarification should include ${keyword}`);
      }
    }
    return;
  }

  if (item.type === "status") {
    expect(route.next_action, "check_feedback_status", item, "next_action");
    return;
  }

  if (item.type === "status_clarify") {
    if (route.next_action === "check_feedback_status") return;
    if (route.intent === "unclear") return;
    throw new Error(`status clarify should ask for feedback id, got ${route.next_action}/${route.category}`);
  }

  expect(route.next_action, "ask_clarification", item, "next_action");
  expect(route.category, item.expectedCategory, item, "category");
  if (item.expectedPriority) expect(route.priority_hint, item.expectedPriority, item, "priority_hint");
  if (item.expectedSubCategory) expect(route.sub_category, item.expectedSubCategory, item, "sub_category");
  if (item.expectedEmotion) expect(route.emotion, item.expectedEmotion, item, "emotion");
  for (const riskFlag of item.expectedRiskFlags || []) {
    if (!(route.risk_flags || []).includes(riskFlag)) {
      throw new Error(`risk_flags should include ${riskFlag}`);
    }
  }

  const draft = AgentCore.createFeedbackDraft(item.text, route);
  for (const field of item.missingFields || []) {
    if (!draft.missing_fields.includes(field)) {
      throw new Error(`missing_fields should include ${field}`);
    }
  }
  for (const [field, expected] of Object.entries(item.collectedFields || {})) {
    expect(draft.collected_fields[field], expected, item, `collected_fields.${field}`);
  }
}

function expect(actual, expected, item, field) {
  if (actual !== expected) {
    throw new Error(`${field} expected ${expected}, got ${actual}`);
  }
}
