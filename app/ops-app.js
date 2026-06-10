const opsState = {
  feedbacks: [],
  activeId: "",
};

const opsEls = {
  list: document.querySelector("#opsTicketList"),
  detail: document.querySelector("#opsTicketDetail"),
  count: document.querySelector("#opsCount"),
  search: document.querySelector("#opsSearch"),
  priority: document.querySelector("#priorityFilter"),
  status: document.querySelector("#statusFilter"),
  category: document.querySelector("#categoryFilter"),
  refresh: document.querySelector("#refreshOps"),
};

bootOps();

function bootOps() {
  opsEls.search.addEventListener("input", renderOps);
  opsEls.priority.addEventListener("change", renderOps);
  opsEls.status.addEventListener("change", renderOps);
  opsEls.category.addEventListener("change", renderOps);
  opsEls.refresh.addEventListener("click", renderOps);
  renderOps();
}

function renderOps() {
  opsState.feedbacks = FeedbackStore.readFeedbacks();
  const filtered = filterFeedbacks(opsState.feedbacks);
  opsEls.count.textContent = `${filtered.length} 条`;
  renderList(filtered);
  if (opsState.activeId) renderDetail(opsState.activeId);
}

function filterFeedbacks(feedbacks) {
  const keyword = opsEls.search.value.trim().toLowerCase();
  return feedbacks
    .filter((item) => !opsEls.priority.value || item.issue.priority === opsEls.priority.value)
    .filter((item) => !opsEls.status.value || item.status === opsEls.status.value)
    .filter((item) => !opsEls.category.value || item.issue.category === opsEls.category.value)
    .filter((item) => {
      if (!keyword) return true;
      return [
        item.feedback_id,
        item.player?.uid,
        item.issue?.raw_question,
        item.issue?.ai_summary,
        item.owner,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    })
    .sort(compareFeedbacks);
}

function compareFeedbacks(a, b) {
  const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const statusRank = { submitted: 0, triaged: 1, waiting_player: 2, processing: 3, resolved: 4, closed: 5 };
  return (
    (priorityRank[a.issue.priority] ?? 9) - (priorityRank[b.issue.priority] ?? 9) ||
    (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) ||
    String(b.created_at).localeCompare(String(a.created_at))
  );
}

function renderList(feedbacks) {
  opsEls.list.innerHTML = "";
  if (!feedbacks.length) {
    opsEls.list.innerHTML = '<div class="empty-state">暂无符合条件的反馈。</div>';
    return;
  }
  for (const feedback of feedbacks) {
    const button = document.createElement("button");
    button.className = `ops-ticket-row ${feedback.feedback_id === opsState.activeId ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <div class="row-main">
        <span class="pill priority-${feedback.issue.priority.toLowerCase()}">${escapeHtml(feedback.issue.priority)}</span>
        <strong>${escapeHtml(feedback.feedback_id)}</strong>
        <span>${escapeHtml(AgentCore.getStatusLabel(feedback.status))}</span>
      </div>
      <p>${escapeHtml(feedback.issue.ai_summary)}</p>
      <div class="row-meta">
        <span>${escapeHtml(feedback.issue.category)}</span>
        <span>${escapeHtml(feedback.owner)}</span>
        <span>${escapeHtml(feedback.created_at)}</span>
      </div>
    `;
    button.addEventListener("click", () => renderDetail(feedback.feedback_id));
    opsEls.list.appendChild(button);
  }
}

function renderDetail(feedbackId) {
  const feedback = FeedbackStore.findFeedback(feedbackId);
  opsState.activeId = feedbackId;
  if (!feedback) {
    opsEls.detail.innerHTML = '<div class="empty-state">该反馈不存在或已被清除。</div>';
    return;
  }
  const nextStatuses = AgentCore.getNextStatuses(feedback.status);
  opsEls.detail.innerHTML = `
    <div class="ops-detail-header">
      <div>
        <h2>${escapeHtml(feedback.feedback_id)}</h2>
        <p>${escapeHtml(feedback.issue.ai_summary)}</p>
      </div>
      <span class="pill priority-${feedback.issue.priority.toLowerCase()}">${escapeHtml(feedback.issue.priority)}</span>
    </div>
    <div class="feedback-grid">
      ${fieldHtml("状态", AgentCore.getStatusLabel(feedback.status))}
      ${fieldHtml("负责人", feedback.owner)}
      ${fieldHtml("分类", `${feedback.issue.category} / ${feedback.issue.sub_category}`)}
      ${fieldHtml("情绪", feedback.issue.emotion)}
      ${fieldHtml("风险标签", feedback.issue.risk_flags?.length ? feedback.issue.risk_flags.join("、") : "无")}
      ${fieldHtml("字段完整度", `${completenessText(feedback.field_completeness)} · 缺 ${feedback.missing_fields?.length || 0} 项`)}
      ${fieldHtml("玩家 UID", feedback.player?.uid || "-")}
      ${fieldHtml("创建时间", feedback.created_at)}
    </div>
    <section class="ops-section">
      <h3>玩家原始问题</h3>
      <p>${escapeHtml(feedback.issue.raw_question)}</p>
    </section>
    <section class="ops-section">
      <h3>结构化字段</h3>
      <pre>${escapeHtml(JSON.stringify(feedback.issue.entities || {}, null, 2))}</pre>
    </section>
    <section class="ops-section">
      <h3>状态时间线</h3>
      <ul class="timeline">
        ${(feedback.timeline || []).map((item) => `<li>${escapeHtml(item.at)} · ${escapeHtml(AgentCore.getStatusLabel(item.status))} · ${escapeHtml(item.note)}</li>`).join("")}
      </ul>
    </section>
    <div class="ticket-actions">
      ${nextStatuses.map((status) => `<button type="button" data-next-status="${status}">${escapeHtml(actionLabel(status))}</button>`).join("")}
    </div>
  `;
  opsEls.detail.querySelectorAll("[data-next-status]").forEach((button) => {
    button.addEventListener("click", () => updateStatus(feedback.feedback_id, button.dataset.nextStatus));
  });
  renderList(filterFeedbacks(FeedbackStore.readFeedbacks()));
}

function updateStatus(feedbackId, nextStatus) {
  FeedbackStore.updateFeedback(feedbackId, (feedback) => AgentCore.transitionFeedbackStatus(feedback, nextStatus));
  renderOps();
  renderDetail(feedbackId);
}

function actionLabel(status) {
  const map = {
    triaged: "标记已受理",
    processing: "开始处理",
    waiting_player: "要求玩家补充",
    resolved: "标记已处理",
    closed: "关闭反馈",
  };
  return map[status] || `流转到：${AgentCore.getStatusLabel(status)}`;
}

function fieldHtml(label, value) {
  return `<div class="feedback-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function completenessText(level) {
  const map = { high: "高", medium: "中", low: "低" };
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
