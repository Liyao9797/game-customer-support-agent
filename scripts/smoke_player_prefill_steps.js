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
  sandbox.handlePlayerMessage("我的金币少了10w");
  const firstHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!firstHtml.includes("玩家 UID")) {
    throw new Error("first prompt should ask UID before other asset fields");
  }
  if (firstHtml.includes("资产类型") || firstHtml.includes("资产变化")) {
    throw new Error("first prompt should not ask prefilled asset fields");
  }

  sandbox.handlePlayerMessage("uid:123456789");
  const secondHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!secondHtml.includes("哪个场景") && !secondHtml.includes("兑换") && !secondHtml.includes("商城")) {
    throw new Error("second prompt should ask game_mode_or_scene after prefilled asset fields");
  }
  if (secondHtml.includes("出问题的资产") || secondHtml.includes("资产变化")) {
    throw new Error("second prompt should skip asset_type and asset_change");
  }

  console.log("Player prefilled step smoke tests passed");
});
