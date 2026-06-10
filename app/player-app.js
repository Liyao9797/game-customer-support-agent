const playerState = {
  knowledgeBase: [],
  intentRules: null,
  currentDraft: null,
  selectedCategory: null,
  pendingClarification: null,
  pendingScreenshots: [],
  isSupplementingDraft: false,
};

const playerEls = {
  messages: document.querySelector("#playerMessages"),
  composer: document.querySelector("#playerComposer"),
  input: document.querySelector("#playerInput"),
  back: document.querySelector(".player-back"),
  screenshotInput: document.querySelector("#playerScreenshotInput"),
};

const APP_DATA_VERSION = "bug-direction-1";

bootPlayer();

async function bootPlayer() {
  const [knowledgeBase, intentRules] = await Promise.all([
    loadJson("../data/knowledge_base/card_game_kb_seed.json", APP_DATA_VERSION),
    loadJson("../data/agent/intent_rules_day1.json", APP_DATA_VERSION),
  ]);
  playerState.knowledgeBase = knowledgeBase;
  playerState.intentRules = intentRules;
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => handleQuickCategory(button.dataset.category));
  });
  addAgentMessage("您好，欢迎来到示例棋牌项目客服。请您直接描述问题，我会帮忙处理。");
}

async function loadJson(path, version = "") {
  const url = version ? `${path}?v=${encodeURIComponent(version)}` : path;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

playerEls.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = playerEls.input.value.trim();
  if (!text) return;
  playerEls.input.value = "";
  handlePlayerMessage(text);
});

playerEls.screenshotInput?.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  handleScreenshotSelected(file);
});

playerEls.back?.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  }
});

function handlePlayerMessage(text) {
  addUserMessage(text);
  if (isManualSupportIntent(text)) {
    addAgentMessage("人工客服正在接入中，请稍等。");
    return;
  }
  if (isCardDisputeFeedbackIntent(text)) {
    startCardDisputeFeedback(text);
    return;
  }
  const messageText = playerState.pendingClarification
    ? `${playerState.pendingClarification.raw_text} ${text}`
    : text;
  if (playerState.pendingClarification) playerState.pendingClarification = null;

  if (playerState.currentDraft && isSubmitIntent(text)) {
    if (playerState.currentDraft.missing_fields.length > 0) {
      askNextDraftField(playerState.currentDraft);
      return;
    }
    const feedback = AgentCore.submitFeedback(playerState.currentDraft, FeedbackStore.nextSerial());
    FeedbackStore.addFeedback(feedback);
    playerState.currentDraft = null;
    addAgentMessage(`已帮您提交反馈，反馈编号：${feedback.feedback_id}。\n客服同学会根据您提供的信息继续核查。您之后可以使用该编号查询处理进度。`);
    return;
  }

  if (playerState.currentDraft && playerState.currentDraft.missing_fields.length === 0) {
    appendDraftSupplement(playerState.currentDraft, text);
    playerState.isSupplementingDraft = false;
    addAgentMessage("已记录补充说明，请您确认下面的反馈信息；确认无误后，我会帮您提交。");
    renderPlayerFeedbackCard(playerState.currentDraft);
    return;
  }

  if (playerState.currentDraft && playerState.currentDraft.missing_fields.length > 0) {
    collectDraftField(playerState.currentDraft, text);
    if (playerState.currentDraft.missing_fields.length > 0) {
      askNextDraftField(playerState.currentDraft);
      return;
    }
    addAgentMessage("关键信息已收集完成，请您确认下面的反馈信息；确认无误后，我会帮您提交。");
    renderPlayerFeedbackCard(playerState.currentDraft);
    return;
  }

  const route = AgentCore.classifyMessage(messageText, playerState.intentRules);
  if (isAmbiguousCardTypeQuestion(messageText)) {
    renderCardTypeIntentClarification(messageText);
    return;
  }

  if (route.next_action === "check_feedback_status") {
    renderProgressQuery(messageText, route);
    return;
  }

  if (route.intent === "unclear" || route.category === "未识别") {
    playerState.pendingClarification = { raw_text: messageText, route };
    addAgentMessage(AgentCore.buildFallbackClarification(messageText, route));
    return;
  }

  if (shouldAskConcreteBugDetails(text, route)) {
    playerState.pendingClarification = { raw_text: messageText, route };
    addAgentMessage("请问具体遇到了什么问题？比如卡住、闪退、黑屏、显示异常，还是结算不对？");
    return;
  }

  if (shouldClarifyGenericActivityQuestion(messageText, route)) {
    playerState.pendingClarification = { raw_text: messageText, route };
    addAgentMessage("请问您想咨询哪个活动？不同活动的道具和奖励规则可能不一样。");
    return;
  }

  if (route.next_action === "answer_from_kb") {
    const matches = AgentCore.retrieveKnowledge(messageText, playerState.knowledgeBase);
    const answer = AgentCore.buildKnowledgeAnswer(messageText, route, matches);
    renderGuidedKnowledgeAnswer(answer.content, messageText);
    return;
  }

  const draft = AgentCore.createFeedbackDraft(messageText, route);
  draft.emotion = route.emotion;
  applyPendingScreenshots(draft);
  playerState.currentDraft = draft;
  askNextDraftField(draft);
}

function isManualSupportIntent(text) {
  return /转人工|人工客服|真人客服|找客服|人工处理|人工服务/.test(String(text || ""));
}

function shouldClarifyGenericActivityQuestion(text, route = {}) {
  const content = String(text || "");
  if (route.category !== "活动规则" && route.category !== "活动奖励") return false;
  if (!includesAnyLocal(content, ["活动", "道具", "奖励", "鱼票", "鱼钩", "清空", "清除", "过期"])) return false;
  return !includesAnyLocal(content, ["连续挑战活动", "每日签到", "新手赛事", "自建赛", "大米赛", "入口有礼", "河蚌手册"]);
}

function shouldAskConcreteBugDetails(text, route = {}) {
  if (route.category !== "游戏 BUG") return false;
  const normalized = String(text || "").trim().toLowerCase();
  const directionOnly = ["bug", "BUG", "卡顿/bug", "卡顿/BUG", "卡顿", "问题反馈", "反馈bug", "反馈BUG"];
  return directionOnly.some((item) => normalized === item.toLowerCase());
}

function handleQuickCategory(categoryKey) {
  const config = QUICK_CATEGORY_CONFIG[categoryKey];
  if (!config) return;
  playerState.selectedCategory = categoryKey;
  addUserMessage(config.label);
  addAgentMessage(config.prompt);
  renderSuggestionChips(config.examples);
  playerEls.input.placeholder = config.placeholder;
  playerEls.input.focus();
}

const QUICK_CATEGORY_CONFIG = {
  gameplay: {
    label: "玩法规则",
    prompt: "你想咨询哪类玩法规则？可以直接说玩法名称或牌型问题，比如黄金牌活动、暗牌玩法、连炸、快节奏跑牌玩法、组队牌类等。",
    placeholder: "例如：黄金牌活动飞机能压三带吗？",
    examples: ["黄金牌活动飞机能压三带吗？", "暗牌玩法几张算炸弹？", "王炸和炸弹谁大？"],
  },
  activity: {
    label: "活动奖励",
    prompt: "你想咨询活动规则，还是反馈奖励没到账？请告诉我活动名称、奖励内容或遇到的问题。",
    placeholder: "例如：连续挑战活动鱼票会清空吗？",
    examples: ["连续挑战活动鱼票会清空吗？", "新手赛事奖励没到账", "每日签到断签怎么算？"],
  },
  payment: {
    label: "充值支付",
    prompt: "我来帮您核查充值问题。您可以先点常见问题，或直接说“未到账、重复扣费、退款/未成年人支付”。",
    placeholder: "例如：我充值了 30 元没到账",
    examples: ["充值未到账", "重复扣费了", "订单支付成功但道具没发"],
  },
  issue: {
    label: "BUG/举报/建议",
    prompt: "你想反馈 BUG、举报玩家，还是提体验建议？请尽量说明发生时间、玩法场景、牌局 ID 或截图。",
    placeholder: "例如：对局卡死了",
    examples: ["对局卡死了", "有人开挂还骂人", "匹配太慢了，希望优化"],
  },
};

function renderProgressQuery(text, route) {
  const id = route.entities.feedback_id || (text.match(/FB\d{12}/i) || [])[0]?.toUpperCase();
  if (!id) {
    addAgentMessage("请提供反馈编号，例如 FB202605280001，我可以帮您查询当前处理状态。");
    return;
  }
  const feedback = FeedbackStore.findFeedback(id);
  if (!feedback) {
    addAgentMessage(`暂未找到 ${id}，请确认反馈编号是否输入正确。`);
    return;
  }
  addAgentMessage(`反馈 ${id} 当前状态：${AgentCore.getStatusLabel(feedback.status)}。\n问题摘要：${feedback.issue.ai_summary}`);
}

function renderPlayerFeedbackCard(draft) {
  const card = document.createElement("article");
  card.className = "feedback-card player-feedback-card";
  card.innerHTML = `
    <h3>请确认反馈信息</h3>
    <div class="feedback-grid">
      ${fieldHtml("问题类型", draft.category)}
      ${fieldHtml("问题摘要", draft.ai_summary)}
      ${fieldHtml("已识别信息", formatCollectedFields(draft.collected_fields))}
    </div>
    <div class="card-actions">
      <button type="button" data-action="submit">确认提交</button>
      <button type="button" class="secondary" data-action="continue">继续补充</button>
    </div>
  `;
  card.querySelector('[data-action="submit"]').addEventListener("click", () => handlePlayerMessage("确认提交"));
  card.querySelector('[data-action="continue"]').addEventListener("click", () => {
    playerState.isSupplementingDraft = true;
    addAgentMessage("请补充您想说明的内容，我会一起记录。");
    playerEls.input.focus();
  });
  playerEls.messages.appendChild(card);
  playerEls.messages.scrollTop = playerEls.messages.scrollHeight;
}

function appendDraftSupplement(draft, text) {
  const note = String(text || "").trim();
  if (!note) return;
  const previous = draft.collected_fields.additional_note;
  draft.collected_fields.additional_note = previous ? `${previous}；${note}` : note;
}

function formatCollectedFields(fields = {}) {
  const entries = Object.entries(fields)
    .filter(([key, value]) => shouldShowCollectedField(key, value))
    .map(([key, value]) => `${AgentCore.getFieldLabels([key])[0]}：${formatCollectedValue(value)}`);
  return entries.length ? entries.join("；") : "暂无";
}

function shouldShowCollectedField(key, value) {
  if (value == null || value === "") return false;
  if (Array.isArray(value) && !value.length) return false;
  return ![
    "resource_terms",
    "resource_type",
    "normalized_resource",
    "game_currency_amount",
    "premium_currency_amount",
    "real_money_amount",
    "money_context",
    "asset_context",
    "feedback_id",
  ].includes(key);
}

function formatCollectedValue(value) {
  if (Array.isArray(value)) return value.join("、");
  return String(value);
}

function askNextDraftField(draft) {
  const nextField = draft.missing_fields[0];
  draft.pending_field = nextField;
  addAgentMessage(buildSingleFieldPrompt(draft, nextField));
}

function collectDraftField(draft, value) {
  const field = draft.pending_field || draft.missing_fields[0];
  if (!field) return;
  draft.collected_fields[field] = normalizeCollectedField(field, value);
  draft.missing_fields = draft.required_fields.filter((item) => !draft.collected_fields[item]);
  draft.pending_field = draft.missing_fields[0] || "";
}

function buildSingleFieldPrompt(draft, field) {
  const label = AgentCore.getFieldLabels([field])[0];
  const isFirstQuestion = !draft.asked_fields?.length;
  draft.asked_fields = Array.from(new Set([...(draft.asked_fields || []), field]));
  const opener = isFirstQuestion ? (draft.service_opener || getDraftOpener(draft)) : "";
  const examples = {
    uid: "请您先提供玩家 UID。",
    amount: "请问充值金额是多少？",
    payment_time: "请问是什么时候充值的呢？请告诉我日期和具体时间。",
    payment_channel: "请问您是通过哪个渠道支付的？",
    item: "请问您购买的是哪个道具或礼包？",
    order_id_or_screenshot: "请问您是否有订单号或支付截图？",
    asset_type: "请问是哪种资产出现问题？金币、钻石，还是其他道具？",
    asset_change: "请问缺失了多少呢？",
    game_mode_or_scene: "请问问题发生在哪个场景？兑换、商城、结算后，还是某个玩法中？",
    activity_name: "请问是哪一个活动？",
    completed_at: "请问大概是什么时候完成的？",
    expected_reward: "请问原本应该获得什么奖励？",
    actual_result: "请问您实际获得了什么呢？",
    screenshot: "请问您是否有截图？",
    occurred_at: "请问大概是什么时候发生的？",
    game_mode: "请问发生在哪个玩法？例如三人牌局、暗牌玩法。",
    table_or_round_id: "请问当时是什么场次？例如初级场、比赛场或好友房；如果不记得，也可以说不清楚。",
    app_version: "请问当前游戏版本号是多少？",
    device: "请问您使用的是什么设备？",
    os: "请问系统版本是多少？",
    screenshot_or_video: "您可以点击输入框旁边的＋上传截图。",
    reported_user: "请问被举报玩家的昵称或 UID 是什么？或者座位在您的哪个方向？",
    report_reason: "请问您主要想举报什么行为？",
    evidence: "您可以点击输入框旁边的＋上传截图。",
    module: "请问您认为哪个功能需要优化？",
    current_problem: "请问体验时遇到了什么问题？",
    expected_improvement: "请问您希望如何改进？",
    frequency: "请问大概多久会遇到一次？",
  };
  return [opener, examples[field] || `发我${label}。`].filter(Boolean).join("\n");
}

function handleScreenshotSelected(file) {
  addUserMessage(`上传截图：${file.name}`);
  if (!playerState.currentDraft) {
    playerState.pendingScreenshots.push(file.name);
    addAgentMessage("已收到截图。请您再简单描述一下遇到的问题，我会一起帮您记录。");
    return;
  }
  attachScreenshotToDraft(playerState.currentDraft, file.name);
  addAgentMessage(`已收到截图：${file.name}`);
  if (!playerState.currentDraft.missing_fields.length) {
    addAgentMessage("关键信息已收集完成，请您确认下面的反馈信息。");
    renderPlayerFeedbackCard(playerState.currentDraft);
  }
}

function applyPendingScreenshots(draft) {
  if (!playerState.pendingScreenshots.length) return;
  for (const fileName of playerState.pendingScreenshots) {
    attachScreenshotToDraft(draft, fileName);
  }
  playerState.pendingScreenshots = [];
}

function attachScreenshotToDraft(draft, fileName) {
  const screenshotFields = ["screenshot", "screenshot_or_video", "evidence", "order_id_or_screenshot"];
  const field =
    draft.missing_fields.find((item) => screenshotFields.includes(item)) ||
    draft.required_fields.find((item) => screenshotFields.includes(item)) ||
    "screenshot_or_video";
  const existing = draft.collected_fields[field];
  const screenshots = [];
  if (existing) {
    screenshots.push(...String(existing).split("、").filter(Boolean));
  }
  const label = `截图：${fileName}`;
  if (!screenshots.includes(label)) screenshots.push(label);
  draft.collected_fields[field] = screenshots.join("、");
  draft.missing_fields = draft.required_fields.filter((item) => !draft.collected_fields[item]);
  draft.pending_field = draft.missing_fields[0] || "";
}

function getDraftOpener(draft) {
  if (draft.emotion === "强烈负面" || draft.emotion === "明显负面") {
    if (draft.category === "支付充值") return "好的，我先帮您核查这笔充值。";
    if (draft.category === "游戏 BUG") return "收到，我先帮您记录。";
    if (draft.category === "活动奖励") return "好的，我先帮您核对奖励情况。";
    return "我先帮您把问题记录清楚。";
  }
  return "";
}

function normalizeCollectedField(field, value) {
  const text = String(value).trim();
  if (field === "amount") {
    const amount = text.match(/(\d+(?:\.\d+)?)/);
    return amount ? Number(amount[1]) : text;
  }
  return text;
}

function renderGuidedKnowledgeAnswer(content, question) {
  const cleanContent = stripInternalReferences(content);
  const messageText = buildKnowledgeMessageText(cleanContent, question);
  const followUps = buildFollowUpQuestions(question, cleanContent);
  addAgentMessage(messageText);

  const card = document.createElement("article");
  card.className = "answer-action-card";
  card.innerHTML = `
    <div class="answer-action-list">
      ${followUps.map((item) => `<button type="button" data-follow-up="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
    </div>
  `;

  card.querySelectorAll("[data-follow-up]").forEach((button) => {
    button.addEventListener("click", () => {
      markSelectedActionButton(button);
      handlePlayerMessage(button.dataset.followUp);
    });
  });

  playerEls.messages.appendChild(card);
  playerEls.messages.scrollTop = playerEls.messages.scrollHeight;
}

function renderCardTypeIntentClarification(question) {
  const followUps = buildCardTypeClarificationQuestions(question);
  const message = isAmbiguousCardMultiplierQuestion(question)
    ? "请问您想了解哪个玩法的规则呢？不同玩法的牌型和倍率规则有差异。"
    : "你是想看这个玩法有哪些牌型，还是想看牌型之间谁大谁小？";
  addAgentMessage(message);

  const card = document.createElement("article");
  card.className = "answer-action-card";
  card.innerHTML = `
    <div class="answer-action-list">
      ${followUps.map((item) => `<button type="button" data-follow-up="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
    </div>
  `;
  card.querySelectorAll("[data-follow-up]").forEach((button) => {
    button.addEventListener("click", () => {
      markSelectedActionButton(button);
      const resolvedQuestion = buildClarifiedCardRuleQuestion(question, button.dataset.followUp);
      handlePlayerMessage(resolvedQuestion);
    });
  });
  playerEls.messages.appendChild(card);
  playerEls.messages.scrollTop = playerEls.messages.scrollHeight;
}

function addUserMessage(content) {
  addMessage("user", content);
}

function addAgentMessage(content) {
  addMessage("agent", content);
}

function addMessage(role, content) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  const speaker = role === "agent" ? "示例客服" : "我";
  message.innerHTML = `
    <span class="message-speaker">${speaker}</span>
    <span class="message-content">${escapeHtml(content)}</span>
  `;
  playerEls.messages.appendChild(message);
  playerEls.messages.scrollTop = playerEls.messages.scrollHeight;
}

function renderSuggestionChips(examples) {
  const wrapper = document.createElement("article");
  wrapper.className = "suggestion-card";
  wrapper.innerHTML = `
    <span>你也可以点一个常见问题继续：</span>
    <div class="suggestion-list">
      ${examples.map((example) => `<button type="button" data-suggestion="${escapeHtml(example)}">${escapeHtml(example)}</button>`).join("")}
    </div>
  `;
  wrapper.querySelectorAll("[data-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      markSelectedActionButton(button);
      handlePlayerMessage(button.dataset.suggestion);
    });
  });
  playerEls.messages.appendChild(wrapper);
  playerEls.messages.scrollTop = playerEls.messages.scrollHeight;
}

function fieldHtml(label, value) {
  return `<div class="feedback-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function stripInternalReferences(content) {
  return String(content).replace(/KB-CARD-\d{8}-\d{4}/g, "").trim();
}

function buildBriefAnswer(content, question = "") {
  const exactMultiplier = buildExactCardMultiplierAnswer(content, question);
  if (exactMultiplier) return exactMultiplier;

  const knownGap = buildKnownCardMultiplierGapAnswer(content, question);
  if (knownGap) return knownGap;

  const focus = detectQuestionFocus(question);
  const focusedSentence = extractFocusedSentence(content, question, focus);
  if (focusedSentence) return focusedSentence;

  const relationSummary = extractRelationSummary(content, question);
  if (relationSummary) return relationSummary;

  const sentences = String(content)
    .split(/(?<=[。！？!?])|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const questionTerms = extractBriefTerms(question);
  const relationTerms = ["大", "压", "压制", "最大", "清空", "到账", "炸弹", "王炸", "算", "不会", "可以"];
  const best = sentences
    .map((sentence, index) => {
      const termScore = questionTerms.filter((term) => sentence.includes(term)).length * 3;
      const relationScore = relationTerms.filter((term) => sentence.includes(term)).length;
      return { sentence, score: termScore + relationScore - index * 0.1 };
    })
    .sort((a, b) => b.score - a.score)[0]?.sentence;
  const picked = best || sentences[0] || content;
  return picked.length > 70 ? `${picked.slice(0, 70)}...` : picked;
}

function buildKnowledgeMessageText(content, question = "") {
  const brief = buildBriefAnswer(content, question);
  if (brief.includes("请问你还想了解") || brief.includes("请问您还想了解")) return brief;
  return `${brief}\n\n你可能还想继续确认这些问题：`;
}

function detectQuestionFocus(question = "") {
  if (includesAnyLocal(question, ["几张"]) && includesAnyLocal(question, ["算炸弹", "是炸弹", "炸弹"])) return "card_type_count_rule";
  if (includesAnyLocal(question, ["几副", "多少张牌", "共多少张", "几张牌"])) return "deck_count_rule";
  if (includesAnyLocal(question, ["几张", "多少", "几个", "几轮", "几倍"])) return "count_rule";
  if (includesAnyLocal(question, ["清空", "清除", "保留", "会不会没", "会消失"])) return "clearance_rule";
  if (includesAnyLocal(question, ["能配", "能不能", "可以吗", "能否", "算不算"])) return "eligibility_rule";
  if (includesAnyLocal(question, ["谁大", "哪个大", "能压", "压", "压制", "大小", "最大"])) return "comparison_rule";
  return "definition_rule";
}

function extractFocusedSentence(content, question, focus) {
  const sentences = splitAnswerSentences(content);
  const questionTerms = extractBriefTerms(question);
  const focusKeywords = {
    card_type_count_rule: ["三张及以上", "相同点数", "为炸弹", "算炸弹"],
    deck_count_rule: ["2 副", "3 副", "108 张", "共"],
    count_rule: ["三张及以上", "2 副", "3 副", "108 张", "张", "副", "轮", "倍", "每人"],
    clearance_rule: ["不会", "不清", "不被清除", "清空", "清除", "保留"],
    eligibility_rule: ["可以", "不能", "王牌以外", "任意牌", "视为", "算"],
    comparison_rule: [">", "＞", "压制", "最大", "谁大", "大于", "小于"],
    definition_rule: [],
  }[focus] || [];

  const best = sentences
    .filter((sentence) => !sentence.startsWith("边界说明"))
    .map((sentence, index) => {
      const termScore = questionTerms.filter((term) => sentence.includes(term)).length * 2;
      const focusScore = focusKeywords.filter((term) => sentence.includes(term)).length * 5;
      const negativeScore = focus !== "comparison_rule" && includesAnyLocal(sentence, [">", "＞", "压制", "最大"]) ? 6 : 0;
      const deckPenalty = focus === "card_type_count_rule" && includesAnyLocal(sentence, ["2 副", "3 副", "108 张", "共"]) ? 8 : 0;
      const cardTypePenalty = focus === "deck_count_rule" && includesAnyLocal(sentence, ["三张及以上", "相同点数", "为炸弹"]) ? 8 : 0;
      return { sentence, score: termScore + focusScore - negativeScore - deckPenalty - cardTypePenalty - index * 0.05 };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score <= 0) return "";
  return trimBrief(best.sentence);
}

function extractRelationSummary(content, question = "") {
  const questionTerms = extractBriefTerms(question);
  const relationMatches = String(content).match(/[^。！？!?]*[>＞][^。！？!?]*[。！？!?]?/g) || [];
  const scored = relationMatches
    .map((sentence, index) => {
      const clean = sentence.trim().replace(/^.*?(?=[^，。！？!?]*[>＞])/, "");
      const termScore = questionTerms.filter((term) => clean.includes(term)).length * 3;
      const relationScore = (clean.match(/[>＞]/g) || []).length * 2;
      return { sentence: clean, score: termScore + relationScore - index * 0.1 };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (!scored?.sentence) return "";
  const sentence = scored.sentence.replace(/[。！？!?]$/, "");
  return trimBrief(sentence);
}

function buildFollowUpQuestions(question, content) {
  const text = `${question}\n${content}`;
  if (isKnownCardMultiplierGapQuestion(question, content)) {
    const mode = inferCardTypeMode(question);
    return [
      `${mode}所有牌型有哪些？`,
      `${mode}牌型大小？`,
    ];
  }
  if (includesAnyLocal(text, ["王炸", "炸弹", "牌型", "压制", "三带", "飞机", "连对", "顺子"])) {
    return [
      "完整牌型大小怎么排？",
      "普通牌型之间怎么比较？",
      "这局牌型有争议，怎么提交牌局核查？",
    ];
  }
  if (includesAnyLocal(text, ["钓鱼", "鱼票", "鱼钩", "签到", "活动", "奖励", "新手赛事"])) {
    return [
      "活动道具会不会清空？",
      "奖励没到账要提供什么？",
      "这个活动规则以哪里为准？",
    ];
  }
  if (includesAnyLocal(text, ["充值", "到账", "扣费", "订单", "退款", "人民币", "元"])) {
    return [
      "充值未到账要提供什么？",
      "重复扣费怎么提交反馈？",
      "怎么查询反馈处理进度？",
    ];
  }
  return [
    "我想问具体规则细节",
    "这个问题要提交反馈吗？",
    "怎么查询处理进度？",
  ];
}

function buildExactCardMultiplierAnswer(content, question = "") {
  if (!hasExplicitGameplayMode(question) || !hasExplicitMultiplierTerm(question)) return "";
  const mode = inferCardTypeMode(question);
  const cardTerm = extractCardRuleTerm(question);
  if (!cardTerm) return "";
  if (!contentMatchesGameplayMode(content, mode)) return "";
  const escapedTerm = cardTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedTerm}[（(][^）)]*[）)]\\s*([0-9]+\\s*倍(?:--\\s*[0-9]+\\s*倍)?)`);
  const match = String(content).match(pattern);
  if (!match) return "";
  return `${mode}${cardTerm}是 ${match[1].replace(/\\s+/g, " ")}。`;
}

function hasExplicitMultiplierTerm(text) {
  return includesAnyLocal(String(text), ["倍率", "倍数", "几倍", "多少倍"]);
}

function isAmbiguousCardTypeQuestion(question = "") {
  const text = String(question).trim();
  if (isAmbiguousCardMultiplierQuestion(text)) return true;
  if (!includesAnyLocal(text, ["牌型", "牌形"])) return false;
  if (includesAnyLocal(text, [
    "哪些",
    "有哪些",
    "谁大",
    "哪个大",
    "大小",
    "排行",
    "怎么排",
    "比较",
    "能压",
    "压制",
    "几张",
    "几副",
    "多少",
    "倍率",
    "倍数",
    "几倍",
    "多少倍",
    "怎么算",
    "能不能",
    "可以吗",
    "争议",
    "核查",
  ])) {
    return false;
  }
  return extractBriefTerms(text).length <= 3;
}

function isCardDisputeFeedbackIntent(question = "") {
  const text = String(question);
  return includesAnyLocal(text, ["牌型", "牌形", "炸弹", "王炸", "三带", "飞机", "连对", "顺子", "对子"]) &&
    includesAnyLocal(text, ["争议", "核查", "提交", "不对", "算错", "没算", "压不住", "压不了"]);
}

function startCardDisputeFeedback(rawText) {
  const route = {
    intent: "submit_feedback",
    category: "游戏 BUG",
    sub_category: "牌型/结算争议",
    entities: {},
    emotion: "中性",
    risk_flags: ["manual_review"],
    priority_hint: "P2",
    next_action: "create_feedback",
    confidence: 0.82,
    required_fields: ["uid", "occurred_at", "game_mode", "table_or_round_id", "screenshot_or_video"],
  };
  const draft = AgentCore.createFeedbackDraft(rawText, route);
  draft.emotion = route.emotion;
  draft.service_opener = "我先帮您记录这局牌型争议，后续客服同学会结合您提供的信息核查。";
  applyPendingScreenshots(draft);
  playerState.currentDraft = draft;
  askNextDraftField(draft);
}

function markSelectedActionButton(button) {
  const siblings = button?.parentElement?.querySelectorAll?.("button") || [];
  siblings.forEach((item) => item.classList?.remove("selected"));
  button?.classList?.add("selected");
}

function buildClarifiedCardRuleQuestion(originalQuestion = "", selectedQuestion = "") {
  const original = String(originalQuestion).trim();
  const selected = String(selectedQuestion).trim();
  if (!original || !selected) return selected || original;
  if (!isAmbiguousCardMultiplierQuestion(original)) return selected;
  if (includesAnyLocal(selected, ["争议", "核查", "提交"])) return selected;

  const mode = inferCardTypeMode(selected);
  const cardTerm = extractCardRuleTerm(original) || extractCardRuleTerm(selected);
  const intentTerm = extractCardRuleIntentTerm(original) || extractCardRuleIntentTerm(selected);
  if (!mode || mode === "当前玩法" || !cardTerm || !intentTerm) return selected;
  if (selected.includes(cardTerm) && selected.includes(intentTerm)) return selected;
  return `${mode}${cardTerm}${intentTerm}`;
}

function buildCardTypeClarificationQuestions(question) {
  if (isAmbiguousBombRuleQuestion(question)) {
    return [
      "三人牌局炸弹规则",
      "暗牌玩法炸弹规则",
      "连续加倍玩法炸弹倍率",
      "快节奏跑牌玩法炸弹倍数",
      "组队牌类炸弹大小",
    ];
  }
  if (isAmbiguousCardMultiplierQuestion(question)) {
    return [
      "三人牌局牌型倍率",
      "暗牌玩法牌型倍率",
      "组队牌类牌型倍率",
      "快节奏跑牌玩法牌型倍数",
      "这局牌型倍率有争议，怎么提交核查？",
    ];
  }
  const mode = inferCardTypeMode(question);
  return [
    `${mode}牌型有哪些？`,
    `${mode}牌型大小怎么排？`,
    `这局${mode}牌型有争议，怎么提交牌局核查？`,
  ];
}

function buildKnownCardMultiplierGapAnswer(content, question = "") {
  const text = String(question);
  const mode = inferCardTypeMode(text);
  const cardTerm = extractCardRuleTerm(text);
  if (!isKnownCardMultiplierGapQuestion(question, content)) return "";
  if (mode === "三人牌局" && cardTerm === "三带") {
    return "三人牌局包含三带一、三带二等牌型。请问你还想了解：";
  }
  if (mode === "组队牌类" && cardTerm === "三带") {
    return "组队牌类包含三带二等牌型。请问你还想了解：";
  }
  if (mode === "快节奏跑牌玩法" && cardTerm === "三带") {
    return "快节奏跑牌玩法包含三带一、三带二等牌型。请问你还想了解：";
  }
  return `${mode}已收录${cardTerm}相关牌型信息。请问你还想了解：`;
}

function isKnownCardMultiplierGapQuestion(question = "", content = "") {
  const text = String(question);
  if (!hasExplicitGameplayMode(text) || !hasMultiplierOrRuleTerm(text)) return false;
  const mode = inferCardTypeMode(text);
  const cardTerm = extractCardRuleTerm(text);
  if (mode === "暗牌" || mode === "黄金牌活动" || !cardTerm || mode === "当前玩法") return false;
  return !(contentMatchesGameplayMode(content, mode) && includesAnyLocal(content, [`${cardTerm}（`, `${cardTerm}(`]) && includesAnyLocal(content, ["倍"]));
}

function contentMatchesGameplayMode(content = "", mode = "") {
  const text = String(content);
  const modeKeywords = {
    三人牌局: ["三人牌局", "三人玩法", "地主"],
    黄金牌活动: ["黄金牌活动"],
    暗牌: ["暗牌玩法", "暗牌玩法"],
    连续加倍玩法: ["连续加倍玩法", "连炸"],
    快节奏发牌玩法: ["不洗牌"],
    快节奏跑牌玩法: ["快节奏跑牌玩法", "跑得快"],
    组队牌类: ["组队牌类"],
  }[mode] || [mode];
  return includesAnyLocal(text, modeKeywords);
}

function isAmbiguousBombRuleQuestion(question = "") {
  const text = String(question).trim();
  if (!text || hasExplicitGameplayMode(text)) return false;
  if (!includesAnyLocal(text, ["炸弹"])) return false;
  if (includesAnyLocal(text, ["王炸和炸弹", "王炸跟炸弹", "王炸比炸弹"])) return false;
  return hasMultiplierOrRuleTerm(text);
}

function extractCardRuleTerm(question = "") {
  const text = String(question);
  return [
    "同花顺",
    "飞机",
    "连对",
    "三带",
    "三张",
    "对子",
    "顺子",
    "炸弹",
    "王炸",
    "单牌",
  ].find((term) => text.includes(term)) || "";
}

function extractCardRuleIntentTerm(question = "") {
  const text = String(question);
  if (includesAnyLocal(text, ["倍率", "倍数", "几倍", "多少倍"])) return "倍数";
  if (includesAnyLocal(text, ["几张"])) return "几张";
  if (includesAnyLocal(text, ["大小", "排行", "压"])) return "大小";
  if (includesAnyLocal(text, ["规则", "怎么算"])) return "规则";
  return "";
}

function isAmbiguousCardMultiplierQuestion(question = "") {
  const text = String(question).trim();
  if (!text || hasExplicitGameplayMode(text)) return false;
  if (!includesAnyLocal(text, [
    "炸弹",
    "王炸",
    "对子",
    "单牌",
    "顺子",
    "连对",
    "飞机",
    "三带",
    "三张",
    "同花顺",
  ])) {
    return false;
  }
  if (includesAnyLocal(text, ["王炸和炸弹", "王炸跟炸弹", "王炸比炸弹"])) return false;
  return hasMultiplierOrRuleTerm(text);
}

function hasMultiplierOrRuleTerm(text) {
  return includesAnyLocal(text, [
    "倍率",
    "倍数",
    "几倍",
    "多少倍",
    "几张",
    "怎么算",
    "规则",
    "大小",
    "排行",
    "有问题",
    "不对",
    "没算",
    "算错",
    "压不住",
    "压不了",
  ]);
}

function hasExplicitGameplayMode(question = "") {
  return includesAnyLocal(String(question), [
    "三人牌局",
    "标准牌局",
    "黄金牌活动",
    "暗牌玩法",
    "暗牌",
    "连续加倍玩法",
    "连炸",
    "快节奏发牌玩法",
    "不洗牌",
    "快节奏跑牌玩法",
    "跑得快",
    "组队牌类",
    "七星牌",
    "百花七星",
    "炸红眼",
    "炸瞪眼",
    "打大A",
    "打大 A",
    "组队2v2",
    "组队 2v2",
  ]);
}

function inferCardTypeMode(question = "") {
  const text = String(question);
  if (includesAnyLocal(text, ["三人牌局", "标准牌局"])) return "三人牌局";
  if (includesAnyLocal(text, ["黄金牌活动"])) return "黄金牌活动";
  if (includesAnyLocal(text, ["暗牌"])) return "暗牌";
  if (includesAnyLocal(text, ["组队牌类"])) return "组队牌类";
  if (includesAnyLocal(text, ["快节奏跑牌玩法", "跑得快"])) return "快节奏跑牌玩法";
  if (includesAnyLocal(text, ["不洗牌"])) return "快节奏发牌玩法";
  if (includesAnyLocal(text, ["连炸"])) return "连续加倍玩法";
  return "当前玩法";
}

function extractBriefTerms(text) {
  return Array.from(new Set(String(text).match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g) || []));
}

function includesAnyLocal(text, keywords) {
  return keywords.some((keyword) => String(text).includes(keyword));
}

function splitAnswerSentences(content) {
  return String(content)
    .split(/(?<=[。！？!?])|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimBrief(sentence) {
  const clean = String(sentence).replace(/[。！？!?]$/, "");
  return clean.length > 76 ? `${clean.slice(0, 76)}...` : clean;
}

function isSubmitIntent(text) {
  return ["确认", "提交", "确认提交", "可以", "好的"].includes(text.trim());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
