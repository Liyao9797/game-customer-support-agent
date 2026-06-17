const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");
const AgentCore = require(path.join(root, "app/agent-core.js"));
const js = fs.readFileSync(path.join(root, "app/player-app.js"), "utf8");
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/agent/intent_rules_day1.json"), "utf8"));
const knowledgeBase = JSON.parse(fs.readFileSync(path.join(root, "data/knowledge_base/card_game_kb_seed.json"), "utf8"));

const results = [];
const sandbox = createPlayerSandbox();

function record(id, title, run) {
  try {
    const detail = run();
    results.push({ id, title, status: "PASS", detail: detail || "" });
  } catch (error) {
    results.push({ id, title, status: "FAIL", detail: error.message });
  }
}

function createPlayerSandbox() {
  const messagesElement = makeElement("section");
  const inputElement = makeElement("input");
  const composerElement = makeElement("form");
  const backElement = makeElement("button");
  const screenshotInputElement = makeElement("input");
  const sandbox = {
    console,
    window: { history: { length: 0, back() {} } },
    document: {
      querySelector(selector) {
        if (selector === "#playerMessages") return messagesElement;
        if (selector === "#playerInput") return inputElement;
        if (selector === "#playerComposer") return composerElement;
        if (selector === ".player-back") return backElement;
        if (selector === "#playerScreenshotInput") return screenshotInputElement;
        return makeElement("div");
      },
      querySelectorAll() {
        return [];
      },
      createElement(tagName) {
        return makeElement(tagName);
      },
    },
    fetch(url) {
      if (String(url).includes("knowledge_base")) return Promise.resolve({ ok: true, json: () => Promise.resolve(knowledgeBase) });
      if (String(url).includes("intent_rules")) return Promise.resolve({ ok: true, json: () => Promise.resolve(rules) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    },
    AgentCore,
    FeedbackStore: {
      nextSerial() {
        return 1;
      },
      addFeedback(feedback) {
        sandbox.__feedbacks.push(feedback);
      },
      findFeedback(id) {
        return sandbox.__feedbacks.find((item) => item.feedback_id === id) || null;
      },
    },
    __feedbacks: [],
    __messages: messagesElement,
    __input: inputElement,
    __screenshotInput: screenshotInputElement,
    __rules: rules,
    __knowledgeBase: knowledgeBase,
  };
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);
  vm.runInContext("playerState.intentRules = __rules; playerState.knowledgeBase = __knowledgeBase;", sandbox);
  return sandbox;
}

function makeElement(tagName) {
  const element = {
    tagName,
    className: "",
    innerHTML: "",
    textContent: "",
    dataset: {},
    children: [],
    scrollTop: 0,
    scrollHeight: 0,
    value: "",
    files: [],
    attributes: {},
    appendChild(child) {
      this.children.push(child);
      this.scrollHeight = this.children.length;
      return child;
    },
    addEventListener(type, handler) {
      this[`on${type}`] = handler;
    },
    focus() {},
    remove() {},
    querySelector() {
      return makeElement("button");
    },
    querySelectorAll() {
      return [];
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  return element;
}

function allMessages() {
  return sandbox.__messages.children.map((child) => child.innerHTML || child.textContent || "").join("\n");
}

function resetMessages() {
  sandbox.__messages.children = [];
  sandbox.__messages.scrollHeight = 0;
}

function expectIncludes(value, terms, context) {
  for (const term of terms) {
    if (!String(value).includes(term)) {
      throw new Error(`${context} should include "${term}", got: ${value}`);
    }
  }
}

function expectExcludes(value, terms, context) {
  for (const term of terms) {
    if (String(value).includes(term)) {
      throw new Error(`${context} should not include "${term}", got: ${value}`);
    }
  }
}

function getKnowledgeBrief(question) {
  const route = AgentCore.classifyMessage(question, rules);
  const matches = AgentCore.retrieveKnowledge(question, knowledgeBase);
  const answer = AgentCore.buildKnowledgeAnswer(question, route, matches);
  return {
    route,
    matches,
    answer,
    brief: sandbox.buildBriefAnswer(answer.content, question),
    followUps: sandbox.buildFollowUpQuestions(question, answer.content),
    messageText: sandbox.buildKnowledgeMessageText(answer.content, question),
  };
}

function createCompletePaymentDraft() {
  const route = AgentCore.classifyMessage("我充值了30元没到账", rules);
  const draft = AgentCore.createFeedbackDraft("我充值了30元没到账", route);
  draft.collected_fields = {
    uid: "5677",
    amount: 30,
    payment_time: "2026-06-09 12:00",
    payment_channel: "微信",
    item: "道具",
    order_id_or_screenshot: "截图：pay.png",
  };
  draft.missing_fields = [];
  return draft;
}

record("PFT-001", "充值快捷入口问题应保持泛化", () => {
  const paymentConfigMatch = js.match(/payment:\s*{[\s\S]*?examples:\s*\[([\s\S]*?)\]/);
  if (!paymentConfigMatch) throw new Error("payment quick entry config not found");
  const examplesText = paymentConfigMatch[1];
  expectIncludes(examplesText, ["充值未到账", "重复扣费了", "订单支付成功但道具没发"], "payment examples");
  expectExcludes(examplesText, ["我充值了 30 元没到账", "我充值了30元没到账"], "payment examples");
});

record("PFT-002", "反馈确认卡不展示还缺少和英文字段", () => {
  resetMessages();
  sandbox.renderPlayerFeedbackCard(createCompletePaymentDraft());
  const html = allMessages();
  expectIncludes(html, ["请确认反馈信息", "问题类型", "问题摘要", "已识别信息"], "feedback card");
  expectExcludes(html, ["还缺少", "missing_fields", "order_id_or_screenshot"], "feedback card");
});

record("PFT-002B", "反馈确认卡后继续输入应补充当前草稿", () => {
  resetMessages();
  sandbox.__draft = createCompletePaymentDraft();
  vm.runInContext("playerState.currentDraft = __draft;", sandbox);
  sandbox.renderPlayerFeedbackCard(sandbox.__draft);
  sandbox.handlePlayerMessage("补充一下：是在活动礼包页面买的");
  const html = allMessages();
  expectIncludes(html, ["已记录补充说明", "补充说明", "活动礼包页面"], "feedback supplement");
  if (sandbox.__feedbacks.length) throw new Error("supplement should not submit feedback automatically");

  sandbox.handlePlayerMessage("确认提交");
  const feedback = sandbox.__feedbacks[0];
  if (!feedback) throw new Error("feedback should submit after confirmation");
  expectIncludes(feedback.issue.entities.additional_note, ["活动礼包页面"], "submitted feedback supplement");
});

record("PFT-003", "泛问活动道具清空时先追问活动名称", () => {
  resetMessages();
  sandbox.handlePlayerMessage("活动道具会不会清空？");
  const html = allMessages();
  expectIncludes(html, ["请问您想咨询哪个活动"], "generic activity clarification");
  expectExcludes(html, ["未使用的鱼钩和鱼票不会被清除"], "generic activity clarification");
});

record("PFT-004", "三带倍数先追问玩法", () => {
  resetMessages();
  sandbox.renderCardTypeIntentClarification("三带倍数");
  expectIncludes(allMessages(), ["请问您想了解哪个玩法的规则呢", "暗牌玩法牌型倍率", "快节奏跑牌玩法牌型倍数"], "card multiplier clarification");
});

record("PFT-005", "暗牌三带倍数直接回答具体倍数", () => {
  const result = getKnowledgeBrief("暗牌三带倍数");
  expectIncludes(result.brief, ["暗牌", "三带", "4 倍"], "dark-card multiplier answer");
  expectExcludes(result.brief, ["炸弹最大"], "dark-card multiplier answer");
});

record("PFT-006", "快节奏跑牌玩法三带倍数不串到暗牌", () => {
  const result = getKnowledgeBrief("快节奏跑牌玩法三带倍数");
  expectIncludes(result.brief, ["快节奏跑牌玩法", "三带一", "三带二"], "biaodekuai multiplier gap");
  expectExcludes(result.brief, ["4 倍", "暗牌"], "biaodekuai multiplier gap");
});

record("PFT-007", "牌型争议进入反馈收集", () => {
  resetMessages();
  sandbox.handlePlayerMessage("这局牌型有争议，怎么提交牌局核查？");
  const html = allMessages();
  expectIncludes(html, ["我先帮您记录这局牌型争议", "请您先提供玩家 UID"], "card dispute flow");
  expectExcludes(html, ["牌型之间谁大谁小", "完整牌型大小"], "card dispute flow");
});

record("PFT-020", "转人工只回复接入中", () => {
  resetMessages();
  sandbox.handlePlayerMessage("转人工");
  const html = allMessages();
  expectIncludes(html, ["人工客服正在接入中", "请稍等"], "manual handoff");
  expectExcludes(html, ["玩家 UID", "请确认反馈信息"], "manual handoff");
});

record("PFT-021", "无内容抱怨应询问具体问题类型", () => {
  const route = AgentCore.classifyMessage("垃圾游戏", rules);
  const clarification = AgentCore.buildFallbackClarification("垃圾游戏", route);
  expectIncludes(clarification, ["我先帮您看一下", "先选一个方向", "充值/资产", "活动奖励", "卡顿/BUG"], "empty complaint fallback");
  expectExcludes(clarification, ["请您先提供玩家 UID"], "empty complaint fallback");
});

record("PFT-022", "钱没了需要区分人民币与游戏资产", () => {
  const route = AgentCore.classifyMessage("钱没了", rules);
  const clarification = AgentCore.buildFallbackClarification("钱没了", route);
  expectIncludes(clarification, ["人民币充值/扣款", "金币", "钻石"], "money ambiguity fallback");
  expectExcludes(clarification, ["欢乐豆", "豆子"], "money ambiguity fallback");
});

record("PFT-024", "进度查询回复应分行展示编号状态摘要", () => {
  resetMessages();
  vm.runInContext("playerState.currentDraft = null; playerState.pendingClarification = null;", sandbox);
  sandbox.__feedbacks = [];
  sandbox.__feedbacks.push({
    feedback_id: "FB202606160001",
    status: "submitted",
    issue: {
      ai_summary: "玩家反馈对局连续卡住，点击无响应。",
    },
  });
  sandbox.handlePlayerMessage("FB202606160001 处理到哪了");
  const html = allMessages();
  expectIncludes(html, ["反馈编号：FB202606160001", "当前状态：已提交", "问题摘要：玩家反馈对局连续卡住"], "progress query format");
  expectExcludes(html, ["反馈 FB202606160001 当前状态"], "progress query format");
});

const passed = results.filter((item) => item.status === "PASS").length;
const failed = results.filter((item) => item.status === "FAIL");

console.log("Player flow tree audit");
console.log(`Total: ${results.length}, Pass: ${passed}, Fail: ${failed.length}`);
for (const result of results) {
  const suffix = result.detail ? ` - ${result.detail}` : "";
  console.log(`[${result.status}] ${result.id} ${result.title}${suffix}`);
}

if (strict && failed.length) {
  process.exitCode = 1;
}
