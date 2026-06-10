const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const AgentCore = require(path.join(root, "app/agent-core.js"));
const knowledgeBase = JSON.parse(fs.readFileSync(path.join(root, "data/knowledge_base/card_game_kb_seed.json"), "utf8"));
const intentRules = JSON.parse(fs.readFileSync(path.join(root, "data/agent/intent_rules_day1.json"), "utf8"));

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
  sandbox.handlePlayerMessage("新手赛事奖励没到账");

  const firstTurnHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (firstTurnHtml.includes("请确认反馈信息")) {
    throw new Error("feedback card should not render before required fields are collected");
  }
  if (!firstTurnHtml.includes("玩家 UID")) {
    throw new Error("first clarification should ask one field: 玩家 UID");
  }
  if (firstTurnHtml.includes("活动名称、完成时间")) {
    throw new Error("clarification should not ask many fields in one message");
  }
  if (firstTurnHtml.includes("还差") || firstTurnHtml.includes("6 项")) {
    throw new Error("clarification should avoid burdening players with total remaining field count");
  }
  if (firstTurnHtml.includes("填完我会帮你整理成反馈") || firstTurnHtml.includes("一项一项来")) {
    throw new Error("clarification should avoid long repeated template wording");
  }
  if (!firstTurnHtml.includes("先发") && !firstTurnHtml.includes("发我") && !firstTurnHtml.includes("提供")) {
    throw new Error("clarification should stay short and actionable");
  }
  if (firstTurnHtml.length > 1200) {
    throw new Error("clarification turn should stay readable");
  }

  sandbox.handlePlayerMessage("123456789");
  const secondTurnHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!secondTurnHtml.includes("什么时候完成")) {
    throw new Error("second clarification should ask next missing field: 完成时间");
  }
  if (secondTurnHtml.includes("请确认反馈信息")) {
    throw new Error("feedback card should still wait for remaining fields");
  }

  sandbox.handlePlayerMessage("今天晚上 8 点");
  sandbox.handlePlayerMessage("新手赛事称号奖励");
  const beforeLastFieldHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (beforeLastFieldHtml.includes("请确认反馈信息")) {
    throw new Error("feedback card should wait until the last missing field is collected");
  }

  sandbox.handlePlayerMessage("有截图");
  const finalHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!finalHtml.includes("请确认反馈信息")) {
    throw new Error("feedback card should render after all required fields are collected");
  }

  console.log("Player feedback step collection smoke tests passed");
});
