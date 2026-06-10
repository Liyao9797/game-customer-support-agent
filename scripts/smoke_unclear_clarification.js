const fs = require("fs");
const path = require("path");
const vm = require("vm");
const AgentCore = require("../app/agent-core.js");

const rules = JSON.parse(fs.readFileSync("./data/agent/intent_rules_day1.json", "utf8"));

const moneyRoute = AgentCore.classifyMessage("钱没了", rules);
if (moneyRoute.intent !== "unclear" || moneyRoute.category !== "未识别") {
  throw new Error(`钱没了 should stay unclear before one clarification, got ${moneyRoute.category}`);
}

const moneyClarification = AgentCore.buildFallbackClarification("钱没了", moneyRoute);
if (!moneyClarification.includes("人民币") || !moneyClarification.includes("金币") || !moneyClarification.includes("钻石")) {
  throw new Error(`money clarification should ask real money vs game assets, got: ${moneyClarification}`);
}

const clarifiedRealMoneyRoute = AgentCore.classifyMessage("充钱没东西 垃圾游戏 人民币", rules);
if (clarifiedRealMoneyRoute.category !== "支付充值" || clarifiedRealMoneyRoute.intent !== "submit_feedback") {
  throw new Error(`人民币 clarification should route to payment feedback, got: ${clarifiedRealMoneyRoute.category}/${clarifiedRealMoneyRoute.intent}`);
}

const rewardRoute = AgentCore.classifyMessage("奖励没给", rules);
const rewardClarification = AgentCore.buildFallbackClarification("奖励没给", rewardRoute);
if (!rewardClarification.includes("活动") || !rewardClarification.includes("比赛") || !rewardClarification.includes("对局")) {
  throw new Error(`reward clarification should ask source, got: ${rewardClarification}`);
}

const bugRoute = AgentCore.classifyMessage("卡了", rules);
const bugClarification = AgentCore.buildFallbackClarification("卡了", bugRoute);
if (!bugClarification.includes("对局") || !bugClarification.includes("登录") || !bugClarification.includes("支付")) {
  throw new Error(`bug clarification should ask scene, got: ${bugClarification}`);
}

const shortBugRoute = AgentCore.classifyMessage("bug", rules);
if (shortBugRoute.category !== "游戏 BUG" || shortBugRoute.intent !== "submit_feedback") {
  throw new Error(`short bug direction should route to game bug, got ${shortBugRoute.category}/${shortBugRoute.intent}`);
}

const emptyComplaintRoute = AgentCore.classifyMessage("垃圾游戏", rules);
if (emptyComplaintRoute.intent !== "unclear" || emptyComplaintRoute.category !== "未识别") {
  throw new Error(`empty complaint should stay unclear before clarification, got ${emptyComplaintRoute.category}`);
}
const emptyComplaintClarification = AgentCore.buildFallbackClarification("垃圾游戏", emptyComplaintRoute);
if (!emptyComplaintClarification.includes("我先帮您看一下") || !emptyComplaintClarification.includes("先选一个方向") || !emptyComplaintClarification.includes("充值/资产") || !emptyComplaintClarification.includes("卡顿/BUG")) {
  throw new Error(`empty complaint should ask concrete issue in service tone, got: ${emptyComplaintClarification}`);
}

const root = path.resolve(__dirname, "..");
const knowledgeBase = JSON.parse(fs.readFileSync(path.join(root, "data/knowledge_base/card_game_kb_seed.json"), "utf8"));
const intentRules = rules;
const messagesElement = makeElement("section");
const inputElement = makeElement("input");
const composerElement = makeElement("form");
const backElement = makeElement("button");

function makeElement(tagName) {
  return {
    tagName,
    className: "",
    innerHTML: "",
    textContent: "",
    dataset: {},
    children: [],
    scrollTop: 0,
    scrollHeight: 0,
    value: "",
    placeholder: "",
    appendChild(child) {
      this.children.push(child);
      this.scrollHeight = this.children.length;
      return child;
    },
    addEventListener() {},
    focus() {},
    remove() {},
    querySelector() {
      return makeElement("button");
    },
    querySelectorAll() {
      return [];
    },
  };
}

const sandbox = {
  console,
  window: { history: { length: 0, back() {} } },
  document: {
    querySelector(selector) {
      if (selector === "#playerMessages") return messagesElement;
      if (selector === "#playerInput") return inputElement;
      if (selector === "#playerComposer") return composerElement;
      if (selector === ".player-back") return backElement;
      return makeElement("div");
    },
    querySelectorAll(selector) {
      if (selector === "[data-category]") return [];
      return [];
    },
    createElement(tagName) {
      return makeElement(tagName);
    },
  },
  fetch(url) {
    if (String(url).includes("knowledge_base")) return Promise.resolve({ ok: true, json: () => Promise.resolve(knowledgeBase) });
    if (String(url).includes("intent_rules")) return Promise.resolve({ ok: true, json: () => Promise.resolve(intentRules) });
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
    findFeedback() {
      return null;
    },
  },
  __feedbacks: [],
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "app/player-app.js"), "utf8"), sandbox);

setImmediate(() => {
  sandbox.handlePlayerMessage("垃圾游戏");
  const emptyComplaintHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (emptyComplaintHtml.includes("玩家 UID") || emptyComplaintHtml.includes("请确认反馈信息")) {
    throw new Error("empty complaint should not enter feedback collection immediately");
  }
  if (!emptyComplaintHtml.includes("我先帮您看一下") || !emptyComplaintHtml.includes("先选一个方向")) {
    throw new Error(`empty complaint should ask for concrete issue in service tone, got: ${emptyComplaintHtml}`);
  }

  sandbox.handlePlayerMessage("bug");
  const bugDirectionHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!bugDirectionHtml.includes("请问具体遇到了什么问题") || !bugDirectionHtml.includes("卡住") || !bugDirectionHtml.includes("闪退")) {
    throw new Error(`bug direction should ask for concrete bug details, got: ${bugDirectionHtml}`);
  }
  if (bugDirectionHtml.includes("玩家 UID")) {
    throw new Error(`short bug direction should not ask uid before concrete bug details, got: ${bugDirectionHtml}`);
  }

  sandbox.handlePlayerMessage("钱没了");
  const firstHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (firstHtml.includes("玩家 UID") || firstHtml.includes("请确认反馈信息")) {
    throw new Error("unclear money question should not enter feedback collection immediately");
  }
  if (!firstHtml.includes("人民币") || !firstHtml.includes("金币")) {
    throw new Error(`unclear money question should ask a category question, got: ${firstHtml}`);
  }

  sandbox.handlePlayerMessage("金币少了10w");
  const secondHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!secondHtml.includes("玩家 UID")) {
    throw new Error("after clarification answer, player should enter asset feedback collection");
  }

  messagesElement.children = [];
  vm.runInContext("playerState.pendingClarification = null; playerState.currentDraft = null;", sandbox);
  sandbox.handlePlayerMessage("充钱没东西 垃圾游戏");
  sandbox.handlePlayerMessage("人民币");
  const realMoneyHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!realMoneyHtml.includes("玩家 UID")) {
    throw new Error(`after RMB clarification answer, player should enter payment feedback collection, got: ${realMoneyHtml}`);
  }
  if ((realMoneyHtml.match(/人民币充值\/扣款/g) || []).length > 1) {
    throw new Error(`RMB clarification should not repeat money ambiguity question, got: ${realMoneyHtml}`);
  }

  console.log("Unclear clarification smoke tests passed");
});
