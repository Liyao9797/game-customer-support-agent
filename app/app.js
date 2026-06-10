const state = {
  knowledgeBase: [],
  intentRules: null,
  quickReplies: [],
  currentDraft: null,
  feedbacks: [],
  lastRoute: null,
};

const els = {
  messages: document.querySelector("#messages"),
  composer: document.querySelector("#composer"),
  input: document.querySelector("#messageInput"),
  quickReplies: document.querySelector("#quickReplies"),
  inspector: document.querySelector("#inspector"),
  kbCount: document.querySelector("#kbCount"),
  feedbackCount: document.querySelector("#feedbackCount"),
  ticketList: document.querySelector("#ticketList"),
  ticketDetail: document.querySelector("#ticketDetail"),
  resetBtn: document.querySelector("#resetBtn"),
};

boot();

async function boot() {
  try {
    const [knowledgeBase, intentRules, quickReplies] = await Promise.all([
      loadJson("../data/knowledge_base/card_game_kb_seed.json"),
      loadJson("../data/agent/intent_rules_day1.json"),
      loadJson("../data/agent/quick_replies_day1.json"),
    ]);
    state.knowledgeBase = knowledgeBase;
    state.intentRules = intentRules;
    state.quickReplies = quickReplies;
    state.feedbacks = readFeedbacks();
    renderQuickReplies();
    renderDataStatus();
    renderTicketList();
    addAgentMessage(
      "您好，我是示例棋牌项目智能客服。您可以问我玩法规则、活动奖励、充值到账、BUG、举报或建议问题。涉及账号、订单、奖励和牌局争议时，我会帮您整理信息并提交给客服同学处理。",
    );
  } catch (error) {
    addAgentMessage(`本地数据加载失败：${error.message}\n请确认正在从项目根目录启动本地服务器。`);
  }
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

function renderQuickReplies() {
  els.quickReplies.innerHTML = "";
  for (const item of state.quickReplies) {
    const button = document.createElement("button");
    button.className = "quick-button";
    button.type = "button";
    button.innerHTML = `<strong>${escapeHtml(item.label)}</strong><br><span>${escapeHtml(item.examples[0])}</span>`;
    button.addEventListener("click", () => {
      els.input.value = item.examples[0];
      els.input.focus();
    });
    els.quickReplies.appendChild(button);
  }
}

function renderDataStatus() {
  els.kbCount.textContent = `知识库：${state.knowledgeBase.length} 条`;
  els.feedbackCount.textContent = `反馈：${state.feedbacks.length}`;
}

els.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;
  els.input.value = "";
  handleUserMessage(text);
});

els.resetBtn.addEventListener("click", () => {
  els.messages.innerHTML = "";
  state.currentDraft = null;
  state.lastRoute = null;
  renderInspector(null);
  addAgentMessage("对话已清空。你可以继续问玩法规则、活动奖励、充值支付、BUG、举报或建议问题。");
});

function handleUserMessage(text) {
  addUserMessage(text);

  if (state.currentDraft && isSubmitIntent(text)) {
    const feedback = AgentCore.submitFeedback(state.currentDraft, state.feedbacks.length + 1);
    state.feedbacks.push(feedback);
    writeFeedbacks(state.feedbacks);
    renderDataStatus();
    renderTicketList(feedback.feedback_id);
    renderTicketDetail(feedback.feedback_id);
    state.currentDraft = null;
    addAgentMessage(
      `已帮您提交反馈，反馈编号：${feedback.feedback_id}。\n客服同学会根据您提供的信息继续核查，您之后可以使用这个编号查询处理进度。\n\n工单已出现在左侧“反馈工单”列表；点击该工单后，可在输入框上方查看详情和状态流转按钮。`,
      {
        pills: [feedback.issue.priority, feedback.issue.category, feedback.owner],
      },
    );
    return;
  }

  const route = AgentCore.classifyMessage(text, state.intentRules);
  state.lastRoute = route;
  renderInspector(route);

  if (route.next_action === "check_feedback_status") {
    handleStatusQuery(text, route);
    return;
  }

  if (route.next_action === "answer_from_kb") {
    const matches = AgentCore.retrieveKnowledge(text, state.knowledgeBase);
    const answer = AgentCore.buildKnowledgeAnswer(text, route, matches);
    addAgentMessage(answer.content, {
      references: answer.references,
      pills: [route.category, route.priority_hint],
    });
    return;
  }

  const draft = AgentCore.createFeedbackDraft(text, route);
  draft.emotion = route.emotion;
  state.currentDraft = draft;
  if (draft.missing_fields.length > 0) {
    addAgentMessage(AgentCore.buildClarification(draft), {
      pills: [draft.category, draft.priority],
    });
    renderFeedbackCard(draft, false);
  } else {
    renderFeedbackCard(draft, true);
  }
}

function handleStatusQuery(text, route) {
  const id = route.entities.feedback_id || (text.match(/FB\d{12}/i) || [])[0]?.toUpperCase();
  if (!id) {
    addAgentMessage("请提供反馈编号，例如 FB202605270001，我可以帮您查询当前处理状态。");
    return;
  }
  const feedback = state.feedbacks.find((item) => item.feedback_id === id);
  if (!feedback) {
    addAgentMessage(`暂未在本地 mock 数据中找到 ${id}。请确认反馈编号是否正确。`);
    return;
  }
  addAgentMessage(`反馈 ${id} 当前状态：${statusText(feedback.status)}\n问题摘要：${feedback.issue.ai_summary}\n当前负责人：${feedback.owner}`, {
    pills: [feedback.issue.priority, feedback.issue.category, feedback.owner],
  });
  renderTicketDetail(id);
}

function renderTicketList(activeId = "") {
  els.ticketList.innerHTML = "";
  if (!state.feedbacks.length) {
    const empty = document.createElement("div");
    empty.className = "data-status";
    empty.textContent = "暂无反馈工单";
    els.ticketList.appendChild(empty);
    return;
  }
  for (const feedback of [...state.feedbacks].reverse()) {
    const button = document.createElement("button");
    button.className = `ticket-item ${feedback.feedback_id === activeId ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(feedback.feedback_id)} · ${escapeHtml(AgentCore.getStatusLabel(feedback.status))}</strong>
      <span>${escapeHtml(feedback.issue.category)} / ${escapeHtml(feedback.issue.priority)} / ${escapeHtml(feedback.owner)}</span>
      <span>${escapeHtml(feedback.issue.ai_summary)}</span>
    `;
    button.addEventListener("click", () => renderTicketDetail(feedback.feedback_id));
    els.ticketList.appendChild(button);
  }
}

function renderTicketDetail(feedbackId) {
  const feedback = state.feedbacks.find((item) => item.feedback_id === feedbackId);
  if (!feedback) {
    els.ticketDetail.classList.add("hidden");
    els.ticketDetail.innerHTML = "";
    return;
  }
  const nextStatuses = AgentCore.getNextStatuses(feedback.status);
  els.ticketDetail.classList.remove("hidden");
  els.ticketDetail.innerHTML = `
    <div class="ticket-detail-header">
      <div>
        <h3>${escapeHtml(feedback.feedback_id)}</h3>
        <p>${escapeHtml(feedback.issue.ai_summary)}</p>
      </div>
      <span class="pill priority-${feedback.issue.priority.toLowerCase()}">${escapeHtml(feedback.issue.priority)}</span>
    </div>
    <div class="feedback-grid">
      ${fieldHtml("状态", AgentCore.getStatusLabel(feedback.status))}
      ${fieldHtml("负责人", feedback.owner)}
      ${fieldHtml("分类", `${feedback.issue.category} / ${feedback.issue.sub_category}`)}
      ${fieldHtml("字段完整度", `${completenessText(feedback.field_completeness)} · 缺 ${feedback.missing_fields?.length || 0} 项`)}
      ${fieldHtml("飞书同步", FeishuAdapter.getSyncLabel(feedback))}
      ${fieldHtml("同步时间", feedback.collaboration?.last_sync_at || "-")}
      ${fieldHtml("创建时间", feedback.created_at)}
      ${fieldHtml("更新时间", feedback.updated_at)}
    </div>
    <div>
      <h3>状态流转</h3>
      <ul class="timeline">
        ${(feedback.timeline || [])
          .map((item) => `<li>${escapeHtml(item.at)} · ${escapeHtml(AgentCore.getStatusLabel(item.status))} · ${escapeHtml(item.note)}</li>`)
          .join("")}
      </ul>
    </div>
    <div class="ticket-actions">
      <button type="button" data-sync-action="sync">同步到飞书表</button>
      <button type="button" data-sync-action="fail">模拟失败</button>
      ${nextStatuses.map((status) => `<button type="button" data-next-status="${status}">流转到：${escapeHtml(AgentCore.getStatusLabel(status))}</button>`).join("")}
    </div>
  `;
  els.ticketDetail.querySelectorAll("[data-next-status]").forEach((button) => {
    button.addEventListener("click", () => updateTicketStatus(feedback.feedback_id, button.dataset.nextStatus));
  });
  els.ticketDetail.querySelector('[data-sync-action="sync"]').addEventListener("click", () => syncTicketToFeishu(feedback.feedback_id));
  els.ticketDetail.querySelector('[data-sync-action="fail"]').addEventListener("click", () => syncTicketToFeishu(feedback.feedback_id, { forceFail: true }));
  renderTicketList(feedback.feedback_id);
  els.ticketDetail.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function updateTicketStatus(feedbackId, nextStatus) {
  const index = state.feedbacks.findIndex((item) => item.feedback_id === feedbackId);
  if (index < 0) return;
  try {
    state.feedbacks[index] = AgentCore.transitionFeedbackStatus(state.feedbacks[index], nextStatus);
    writeFeedbacks(state.feedbacks);
    renderDataStatus();
    renderTicketList(feedbackId);
    renderTicketDetail(feedbackId);
    addAgentMessage(`反馈 ${feedbackId} 已流转为：${AgentCore.getStatusLabel(nextStatus)}。`);
  } catch (error) {
    addAgentMessage(`状态流转失败：${error.message}`);
  }
}

async function syncTicketToFeishu(feedbackId, options = {}) {
  const index = state.feedbacks.findIndex((item) => item.feedback_id === feedbackId);
  if (index < 0) return;
  const feedback = state.feedbacks[index];
  addAgentMessage(`正在将 ${feedbackId} 同步到飞书玩家反馈表...`);
  const result = await FeishuAdapter.syncFeedback(feedback, options);
  state.feedbacks[index] = FeishuAdapter.buildSyncRecord(feedback, result);
  writeFeedbacks(state.feedbacks);
  renderTicketList(feedbackId);
  renderTicketDetail(feedbackId);
  if (result.ok) {
    addAgentMessage(`同步成功：${feedbackId} 已写入 mock 飞书玩家反馈表。`, {
      pills: ["飞书同步", state.feedbacks[index].collaboration.feishu_record_id],
    });
  } else {
    addAgentMessage(`同步失败：${result.error_message}。已记录失败原因和重试次数。`, {
      pills: ["同步失败", `重试 ${state.feedbacks[index].collaboration.sync_retry_count} 次`],
    });
  }
}

function renderInspector(route) {
  const values = route
    ? [route.intent, route.category, route.priority_hint, route.next_action]
    : ["-", "-", "-", "-"];
  const dds = els.inspector.querySelectorAll("dd");
  dds.forEach((dd, index) => {
    dd.textContent = values[index];
  });
}

function addUserMessage(content) {
  addMessage("user", content);
}

function addAgentMessage(content, options = {}) {
  addMessage("agent", content, options);
}

function addMessage(role, content, options = {}) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  message.textContent = content;
  if (options.pills?.length || options.references?.length) {
    const meta = document.createElement("div");
    meta.className = "meta";
    for (const pill of options.pills || []) {
      if (!pill) continue;
      const span = document.createElement("span");
      span.className = `pill ${String(pill).toLowerCase().startsWith("p") ? `priority-${String(pill).toLowerCase()}` : ""}`;
      span.textContent = pill;
      meta.appendChild(span);
    }
    for (const ref of options.references || []) {
      const span = document.createElement("span");
      span.className = "pill";
      span.textContent = ref.knowledge_id;
      span.title = ref.topic;
      meta.appendChild(span);
    }
    message.appendChild(meta);
  }
  els.messages.appendChild(message);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderFeedbackCard(draft, ready) {
  const card = document.createElement("article");
  card.className = "feedback-card";
  const missingLabels = AgentCore.getFieldLabels(draft.missing_fields);
  card.innerHTML = `
    <h3>反馈确认卡</h3>
    <div class="feedback-grid">
      ${fieldHtml("问题类型", draft.category)}
      ${fieldHtml("具体问题", draft.sub_category || "-")}
      ${fieldHtml("优先级", draft.priority)}
      ${fieldHtml("风险标签", draft.risk_flags.length ? draft.risk_flags.join("、") : "无")}
      ${fieldHtml("问题摘要", draft.ai_summary)}
      ${fieldHtml("仍缺少", missingLabels.length ? missingLabels.join("、") : "无")}
    </div>
    <div class="card-actions">
      <button type="button" data-action="submit">${ready ? "确认提交" : "仍要提交"}</button>
      <button type="button" class="secondary" data-action="continue">继续补充</button>
    </div>
  `;
  card.querySelector('[data-action="submit"]').addEventListener("click", () => {
    handleUserMessage("确认提交");
  });
  card.querySelector('[data-action="continue"]').addEventListener("click", () => {
    els.input.focus();
    els.input.placeholder = "请补充 UID、时间、截图、牌局 ID 等信息";
  });
  els.messages.appendChild(card);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function fieldHtml(label, value) {
  return `<div class="feedback-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function isSubmitIntent(text) {
  return ["确认", "提交", "确认提交", "可以", "好的"].includes(text.trim());
}

function readFeedbacks() {
  try {
    return JSON.parse(localStorage.getItem("tyddz_feedbacks") || "[]");
  } catch {
    return [];
  }
}

function writeFeedbacks(feedbacks) {
  localStorage.setItem("tyddz_feedbacks", JSON.stringify(feedbacks));
}

function statusText(status) {
  return AgentCore.getStatusLabel(status);
}

function completenessText(level) {
  const map = {
    high: "高",
    medium: "中",
    low: "低",
  };
  return map[level] || "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
