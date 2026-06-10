const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const AgentCore = require(path.join(root, "app/agent-core.js"));
const knowledgeBase = JSON.parse(fs.readFileSync(path.join(root, "data/knowledge_base/card_game_kb_seed.json"), "utf8"));
const intentRules = JSON.parse(fs.readFileSync(path.join(root, "data/agent/intent_rules_day1.json"), "utf8"));

const sandbox = {
  console,
  window: { history: { length: 0, back() {} } },
  document: {
    querySelector() {
      return {
        addEventListener() {},
        appendChild() {},
        focus() {},
        scrollTop: 0,
        scrollHeight: 0,
      };
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return {
        className: "",
        innerHTML: "",
        querySelector() {
          return { addEventListener() {} };
        },
        querySelectorAll() {
          return [];
        },
        remove() {},
      };
    },
  },
  fetch() {
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  },
  AgentCore,
  FeedbackStore: {
    nextSerial() {
      return 1;
    },
    addFeedback() {},
    findFeedback() {
      return null;
    },
  },
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "app/player-app.js"), "utf8"), sandbox);

const cases = [
  {
    question: "暗牌玩法几张算炸弹？",
    expected: ["三张及以上", "相同点数"],
  },
  {
    question: "暗牌玩法几副牌？",
    expectedAny: ["2 副", "108 张"],
  },
  {
    question: "连续挑战活动鱼票会清空吗？",
    expected: ["不会", "清除"],
  },
  {
    question: "组队牌类逢人配能配大王吗？",
    expected: ["王牌以外"],
  },
  {
    question: "王炸和炸弹谁大？",
    expected: ["王炸", "炸弹", "其他牌型"],
  },
];

const ambiguousCases = [
  {
    question: "暗牌牌形",
    expected: ["暗牌牌型有哪些？", "暗牌牌型大小怎么排？"],
  },
  {
    question: "组队牌类牌型",
    expected: ["组队牌类牌型有哪些？", "组队牌类牌型大小怎么排？"],
  },
  {
    question: "炸弹倍率有问题",
    expected: ["三人牌局炸弹规则", "暗牌玩法炸弹规则", "连续加倍玩法炸弹倍率"],
  },
  {
    question: "炸弹多少倍",
    expected: ["三人牌局炸弹规则", "暗牌玩法炸弹规则", "连续加倍玩法炸弹倍率"],
  },
  {
    question: "对子多少倍",
    expected: ["三人牌局牌型倍率", "暗牌玩法牌型倍率", "组队牌类牌型倍率"],
  },
];

const resolvedClarificationCases = [
  {
    originalQuestion: "三带倍数",
    selectedQuestion: "暗牌玩法牌型倍率",
    expectedResolvedQuestion: "暗牌三带倍数",
    expectedBrief: ["暗牌", "三带", "4 倍"],
    rejectedBrief: ["炸弹最大", "108 张"],
    expectedFollowUps: ["完整牌型大小怎么排？", "普通牌型之间怎么比较？"],
  },
  {
    originalQuestion: "三带倍数",
    selectedQuestion: "快节奏跑牌玩法牌型倍数",
    expectedResolvedQuestion: "快节奏跑牌玩法三带倍数",
    expectedBrief: ["快节奏跑牌玩法", "三带一", "三带二", "请问你还想了解"],
    rejectedBrief: ["当前资料没有明确记录", "请问你想了解哪一项"],
    expectedFollowUps: ["快节奏跑牌玩法所有牌型有哪些？", "快节奏跑牌玩法牌型大小？"],
  },
  {
    originalQuestion: "三带倍数",
    selectedQuestion: "组队牌类牌型倍率",
    expectedResolvedQuestion: "组队牌类三带倍数",
    expectedBrief: ["组队牌类", "三带二", "请问你还想了解"],
    rejectedBrief: ["108 张", "每人发 27 张"],
    expectedFollowUps: ["组队牌类所有牌型有哪些？", "组队牌类牌型大小？"],
  },
  {
    originalQuestion: "三带倍数",
    selectedQuestion: "三人牌局牌型倍率",
    expectedResolvedQuestion: "三人牌局三带倍数",
    expectedBrief: ["三人牌局", "三带一", "三带二", "请问你还想了解"],
    rejectedBrief: ["王炸 > 炸弹", "地主拥有优先出牌权"],
    expectedFollowUps: ["三人牌局所有牌型有哪些？", "三人牌局牌型大小？"],
  },
];

for (const testCase of cases) {
  const route = AgentCore.classifyMessage(testCase.question, intentRules);
  const matches = AgentCore.retrieveKnowledge(testCase.question, knowledgeBase);
  const answer = AgentCore.buildKnowledgeAnswer(testCase.question, route, matches);
  const brief = sandbox.buildBriefAnswer(answer.content, testCase.question);
  if (testCase.expected) {
    for (const term of testCase.expected) {
      if (!brief.includes(term)) {
        throw new Error(`${testCase.question} brief should include "${term}", got: ${brief}`);
      }
    }
  }
  if (testCase.expectedAny && !testCase.expectedAny.some((term) => brief.includes(term))) {
    throw new Error(`${testCase.question} brief should include one of ${testCase.expectedAny.join(", ")}, got: ${brief}`);
  }
}

for (const testCase of ambiguousCases) {
  if (!sandbox.isAmbiguousCardTypeQuestion(testCase.question)) {
    throw new Error(`${testCase.question} should be treated as ambiguous card-type intent`);
  }
  const questions = sandbox.buildCardTypeClarificationQuestions(testCase.question);
  for (const term of testCase.expected) {
    if (!questions.includes(term)) {
      throw new Error(`${testCase.question} clarification should include "${term}", got: ${questions.join(" / ")}`);
    }
  }
}

for (const testCase of resolvedClarificationCases) {
  const resolvedQuestion = sandbox.buildClarifiedCardRuleQuestion(testCase.originalQuestion, testCase.selectedQuestion);
  if (resolvedQuestion !== testCase.expectedResolvedQuestion) {
    throw new Error(`resolved question should be "${testCase.expectedResolvedQuestion}", got: ${resolvedQuestion}`);
  }
  const route = AgentCore.classifyMessage(resolvedQuestion, intentRules);
  const matches = AgentCore.retrieveKnowledge(resolvedQuestion, knowledgeBase);
  const answer = AgentCore.buildKnowledgeAnswer(resolvedQuestion, route, matches);
  const brief = sandbox.buildBriefAnswer(answer.content, resolvedQuestion);
  for (const term of testCase.expectedBrief) {
    if (!brief.includes(term)) {
      throw new Error(`${resolvedQuestion} brief should include "${term}", got: ${brief}`);
    }
  }
  for (const term of testCase.rejectedBrief || []) {
    if (brief.includes(term)) {
      throw new Error(`${resolvedQuestion} brief should not include "${term}", got: ${brief}`);
    }
  }
  const followUps = sandbox.buildFollowUpQuestions(resolvedQuestion, answer.content);
  const renderedText = sandbox.buildKnowledgeMessageText(answer.content, resolvedQuestion);
  if ((renderedText.match(/请问你还想了解|你可能还想继续确认这些问题/g) || []).length > 1) {
    throw new Error(`${resolvedQuestion} should not render duplicated follow-up prompts, got: ${renderedText}`);
  }
  for (const term of testCase.expectedFollowUps || []) {
    if (!followUps.includes(term)) {
      throw new Error(`${resolvedQuestion} follow-ups should include "${term}", got: ${followUps.join(" / ")}`);
    }
  }
}

console.log("Knowledge brief smoke tests passed");
