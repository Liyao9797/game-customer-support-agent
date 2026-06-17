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
  seedPreviewFeedbacks();
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
  if (!opsState.activeId && filtered.length) opsState.activeId = filtered[0].feedback_id;
  renderList(filtered);
  if (opsState.activeId) {
    if (filtered.some((item) => item.feedback_id === opsState.activeId)) {
      renderDetail(opsState.activeId);
    } else if (filtered.length) {
      opsState.activeId = filtered[0].feedback_id;
      renderDetail(opsState.activeId);
    } else {
      opsState.activeId = "";
      opsEls.detail.innerHTML = '<div class="empty-state">暂无符合条件的反馈。</div>';
    }
  }
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
      </div>
      <p>${escapeHtml(feedback.issue.ai_summary)}</p>
      <div class="row-signals">
        <span class="row-category">${escapeHtml(feedback.issue.category)}</span>
        <span>${escapeHtml(AgentCore.getStatusLabel(feedback.status))}</span>
        <time>${escapeHtml(shortTime(feedback.created_at))}</time>
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
  const rawQuestion = feedback.issue.raw_question || "";
  const shouldCollapseRaw = isLongPlayerVoice(rawQuestion);
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
    <section class="ops-section player-voice-section">
      <div class="ops-section-title">
        <h3>玩家反馈原话</h3>
        <span>${escapeHtml(feedback.player?.uid ? `UID ${feedback.player.uid}` : "玩家")}</span>
      </div>
      <blockquote class="player-voice-text ${shouldCollapseRaw ? "collapsed" : ""}">${escapeHtml(rawQuestion)}</blockquote>
      ${
        shouldCollapseRaw
          ? '<button class="voice-toggle" type="button" data-action="toggle-player-voice" aria-expanded="false">展开原话</button>'
          : ""
      }
      <p><strong>Agent 摘要：</strong>${escapeHtml(feedback.issue.ai_summary)}</p>
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
  opsEls.detail.querySelector('[data-action="toggle-player-voice"]')?.addEventListener("click", togglePlayerVoice);
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

function isLongPlayerVoice(value) {
  return String(value || "").length > 70 || String(value || "").split(/\r?\n/).length > 4;
}

function togglePlayerVoice(event) {
  const button = event.currentTarget;
  const quote = button.closest(".player-voice-section")?.querySelector(".player-voice-text");
  if (!quote) return;
  const isCollapsed = quote.classList.toggle("collapsed");
  button.textContent = isCollapsed ? "展开原话" : "收起原话";
  button.setAttribute("aria-expanded", String(!isCollapsed));
}

function shortTime(value) {
  const match = String(value || "").match(/(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/);
  if (match) return `${match[1]}-${match[2]} ${match[3]}`;
  return value || "-";
}

function seedPreviewFeedbacks() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") !== "readme") return;
  FeedbackStore.writeFeedbacks(buildPreviewFeedbacks());
}

function buildPreviewFeedbacks() {
  return [
    previewFeedback({
      id: "FB202606160001",
      priority: "P1",
      status: "submitted",
      category: "游戏 BUG",
      subCategory: "对局卡顿",
      summary: "玩家反馈经典房间对局中突然卡住，点击无响应。",
      raw: "对局里突然卡住了，点什么都没反应。",
      uid: "10086",
      owner: "技术排查",
      createdAt: "2026-06-16 20:08",
      emotion: "轻微负面",
      completeness: "high",
      entities: { uid: "10086", occurred_at: "今天 20:00 左右", game_mode: "经典房间", device: "iPhone 14", os: "iOS 17", app_version: "1.8.2" },
      riskFlags: ["影响对局体验"],
    }),
    previewFeedback({
      id: "FB202606160002",
      priority: "P0",
      status: "processing",
      category: "支付充值",
      subCategory: "充值未到账",
      summary: "玩家反馈支付成功后道具未到账，涉及付费链路。",
      raw: "我刚充了 30 元，扣款了但是道具没到。支付页面显示成功，银行卡也收到扣费通知，但是回到游戏以后礼包和道具都没有增加。我重新登录了一次还是没有，背包、邮件和活动入口都看过了，也没有补发提示。麻烦帮我尽快查一下，这种付费问题比较着急。如果需要我可以继续补充订单截图，但希望先帮我确认是不是支付链路延迟。",
      uid: "20419",
      owner: "支付客服",
      createdAt: "2026-06-16 19:42",
      emotion: "明显负面",
      completeness: "medium",
      entities: { uid: "20419", amount: "30 元", payment_time: "今天 19:35", payment_channel: "应用商店", item: "礼包" },
      missing: ["order_id_or_screenshot"],
      riskFlags: ["付费投诉", "需优先核查"],
    }),
    previewFeedback({
      id: "FB202606160003",
      priority: "P1",
      status: "triaged",
      category: "举报投诉",
      subCategory: "不当发言",
      summary: "玩家举报对局内存在辱骂发言，已记录房间与时间。",
      raw: "刚才同桌玩家一直骂人，体验很差。",
      uid: "38752",
      owner: "安全运营",
      createdAt: "2026-06-16 18:55",
      emotion: "明显负面",
      completeness: "medium",
      entities: { uid: "38752", occurred_at: "今天 18:40", game_mode: "排位房间", report_reason: "辱骂发言" },
      missing: ["reported_user", "evidence"],
      riskFlags: ["社区安全"],
    }),
    previewFeedback({
      id: "FB202606160004",
      priority: "P2",
      status: "waiting_player",
      category: "活动奖励",
      subCategory: "奖励未领取",
      summary: "玩家称完成活动任务后未收到奖励，缺少活动名称。",
      raw: "我任务做完了，奖励没给。",
      uid: "51980",
      owner: "活动运营",
      createdAt: "2026-06-16 17:21",
      emotion: "轻微负面",
      completeness: "low",
      entities: { uid: "51980", completed_at: "今天下午" },
      missing: ["activity_name", "expected_reward", "screenshot"],
      riskFlags: ["信息待补充"],
    }),
    previewFeedback({
      id: "FB202606160005",
      priority: "P2",
      status: "submitted",
      category: "体验建议",
      subCategory: "新手引导",
      summary: "玩家建议在结算页增加倍率来源说明，降低理解成本。",
      raw: "结算分数为什么这么算看不懂，能不能写清楚倍率来源？",
      uid: "77231",
      owner: "产品运营",
      createdAt: "2026-06-16 16:48",
      emotion: "中性建议",
      completeness: "high",
      entities: { uid: "77231", suggestion: "结算页展示倍率来源", scene: "结算页" },
      riskFlags: [],
    }),
    previewFeedback({
      id: "FB202606160006",
      priority: "P3",
      status: "resolved",
      category: "账号安全",
      subCategory: "登录异常",
      summary: "玩家反馈换机后登录失败，已通过账号找回说明解决。",
      raw: "我换手机以后登录不上了。",
      uid: "91604",
      owner: "账号客服",
      createdAt: "2026-06-16 15:33",
      emotion: "轻微负面",
      completeness: "high",
      entities: { uid_or_phone_suffix: "1604", login_method: "手机号", device: "Android 机型" },
      riskFlags: [],
    }),
  ];
}

function previewFeedback(config) {
  return {
    feedback_id: config.id,
    project: "示例棋牌项目",
    source: "game_webview",
    created_at: config.createdAt,
    updated_at: config.createdAt,
    status: config.status,
    owner: config.owner,
    field_completeness: config.completeness,
    missing_fields: config.missing || [],
    required_fields: [],
    timeline: [
      { status: "submitted", at: config.createdAt, note: "玩家已确认提交反馈。" },
      ...(config.status === "submitted" ? [] : [{ status: config.status, at: config.createdAt, note: "公开版 mock 流转记录。" }]),
    ],
    player: {
      uid: config.uid,
      channel: "game_webview",
      login_version: config.entities.app_version || "",
      device: config.entities.device || "",
      os: config.entities.os || "",
    },
    issue: {
      raw_question: config.raw,
      category: config.category,
      sub_category: config.subCategory,
      ai_summary: config.summary,
      intent: "提交反馈",
      entities: config.entities,
      emotion: config.emotion,
      risk_flags: config.riskFlags,
      priority: config.priority,
      confidence: 0.82,
    },
    collaboration: {
      feishu_doc_synced: false,
      feishu_group_notified: config.priority === "P0",
      notification_level: config.priority === "P0" ? "all" : config.priority === "P1" ? "owner" : "none",
      duplicate_group_id: "",
      related_feedback_count: 1,
      handling_note: "",
      resolution: "",
      closed_at: "",
    },
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
