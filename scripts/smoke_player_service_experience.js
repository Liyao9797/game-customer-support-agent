const fs = require("fs");
const path = require("path");
const vm = require("vm");
const AgentCore = require("../app/agent-core.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app/player.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app/styles.css"), "utf8");
const rules = JSON.parse(fs.readFileSync(path.join(root, "data/agent/intent_rules_day1.json"), "utf8"));
const knowledgeBase = JSON.parse(fs.readFileSync(path.join(root, "data/knowledge_base/card_game_kb_seed.json"), "utf8"));

if (!html.includes('type="file"') || !html.includes('accept="image/*"')) {
  throw new Error("player page should provide an image upload input");
}
if (!html.includes('class="player-left-actions"') || !html.includes('class="player-debug-link"') || !html.includes('href="./index.html"')) {
  throw new Error("player page should provide a debug tool entry");
}
if (!html.includes('id="playerInput"') || html.indexOf('id="playerInput"') > html.indexOf('for="playerScreenshotInput"')) {
  throw new Error("screenshot upload entry should be between text input and send button");
}
if (!html.includes("player-app.js?v=") || !html.includes("bug-direction-1")) {
  throw new Error("player page should use a fresh script version for the latest multiplier fixes");
}
if (css.includes(".answer-action-list button:first-child")) {
  throw new Error("answer action buttons should not always highlight the first option");
}
if (!css.includes(".answer-action-list button.selected")) {
  throw new Error("answer action buttons should support highlighting the clicked option");
}

const emptyRoute = AgentCore.classifyMessage("垃圾策划", rules);
const fallback = AgentCore.buildFallbackClarification("垃圾策划", emptyRoute);
if (!fallback.includes("我先帮您看一下") || !fallback.includes("先选一个方向") || !fallback.includes("充值/资产") || !fallback.includes("卡顿/BUG")) {
  throw new Error(`fallback should be logical grouped service guidance, got: ${fallback}`);
}
if (fallback.includes("比如充值没到账、奖励没发、卡住闪退、举报")) {
  throw new Error("fallback should not be a loose mixed list");
}

const messagesElement = makeElement("section");
const inputElement = makeElement("input");
const composerElement = makeElement("form");
const backElement = makeElement("button");
const screenshotInputElement = makeElement("input");

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
      if (selector === "#playerScreenshotInput") return screenshotInputElement;
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
    findFeedback() {
      return null;
    },
  },
  __feedbacks: [],
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "app/player-app.js"), "utf8"), sandbox);

setImmediate(() => {
  const welcomeHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!welcomeHtml.includes("您好") || !welcomeHtml.includes("请您直接描述问题") || welcomeHtml.includes("生成反馈编号方便你查询进度")) {
    throw new Error(`welcome message should be short and player-facing, got: ${welcomeHtml}`);
  }

  sandbox.handlePlayerMessage("转人工");
  const manualHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!manualHtml.includes("人工客服正在接入中") || !manualHtml.includes("请稍等")) {
    throw new Error(`manual support intent should receive a quick service reply, got: ${manualHtml}`);
  }
  if (manualHtml.includes("玩家 UID") || manualHtml.includes("请确认反馈信息")) {
    throw new Error("manual support intent should not enter feedback collection directly");
  }

  messagesElement.children = [];

  sandbox.renderCardTypeIntentClarification("三带倍数");
  const gentleClarifyHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!gentleClarifyHtml.includes("请问您想了解哪个玩法的规则呢？不同玩法的牌型和倍率规则有差异。")) {
    throw new Error(`gameplay clarification should be polite, got: ${gentleClarifyHtml}`);
  }

  messagesElement.children = [];

  sandbox.handlePlayerMessage("这局牌型有争议，怎么提交牌局核查？");
  const disputeHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!disputeHtml.includes("我先帮您记录这局牌型争议") || !disputeHtml.includes("请您先提供玩家 UID")) {
    throw new Error(`card dispute should enter feedback collection and ask uid first, got: ${disputeHtml}`);
  }
  if (disputeHtml.includes("牌型之间谁大谁小") || disputeHtml.includes("完整牌型大小")) {
    throw new Error(`card dispute should not continue knowledge clarification, got: ${disputeHtml}`);
  }
  vm.runInContext("playerState.currentDraft = null", sandbox);

  messagesElement.children = [];

  sandbox.handlePlayerMessage("对局卡死了");
  sandbox.handlePlayerMessage("123456789");
  screenshotInputElement.files = [{ name: "early-bug.png" }];
  screenshotInputElement.onchange({ target: screenshotInputElement });
  const earlyUploadHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!earlyUploadHtml.includes("已收到截图：early-bug.png")) {
    throw new Error("screenshot uploaded during the process should be acknowledged");
  }

  const timePromptHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!timePromptHtml.includes("请问大概是什么时候发生的？")) {
    throw new Error(`time prompt should offer clear memory anchors, got: ${timePromptHtml}`);
  }

  sandbox.handlePlayerMessage("今天下午");
  const gameplayHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (gameplayHtml.includes("牌局 ID") || gameplayHtml.includes("房间号") || gameplayHtml.includes("轮次")) {
    throw new Error("bug troubleshooting should not ask player for hidden ids");
  }
  if (!gameplayHtml.includes("哪个玩法")) {
    throw new Error(`bug troubleshooting should ask gameplay, got: ${gameplayHtml}`);
  }

  sandbox.handlePlayerMessage("三人牌局");
  const stageHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (stageHtml.includes("牌局 ID") || stageHtml.includes("房间号") || stageHtml.includes("轮次")) {
    throw new Error("stage prompt should not ask player for hidden ids");
  }
  if (!stageHtml.includes("什么场次") || !stageHtml.includes("初级场")) {
    throw new Error(`bug troubleshooting should ask stage, got: ${stageHtml}`);
  }

  sandbox.handlePlayerMessage("初级场");
  sandbox.handlePlayerMessage("1.5.3");
  sandbox.handlePlayerMessage("iPhone 15");
  sandbox.handlePlayerMessage("iOS 18");
  const finalHtml = messagesElement.children.map((child) => child.innerHTML || child.textContent).join("\n");
  if (!finalHtml.includes("已收到截图：early-bug.png")) {
    throw new Error("screenshot uploaded during the process should stay attached to feedback");
  }
  if (!finalHtml.includes("请确认反馈信息")) {
    throw new Error("feedback card should render without asking screenshot again");
  }
  if (!finalHtml.includes("截图或录屏：截图：early-bug.png")) {
    throw new Error(`feedback card should include uploaded screenshot in Chinese fields, got: ${finalHtml}`);
  }
  if (/(reported_user|table_or_round_id|occurred_at|report_reason|evidence|screenshot_or_video|game_mode)/.test(finalHtml)) {
    throw new Error(`feedback card should not show English field keys, got: ${finalHtml}`);
  }

  console.log("Player service experience smoke tests passed");
});
