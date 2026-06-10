(function initFeishuAdapter(global) {
  function mapFeedbackToFeishuRow(feedback) {
    return {
      feedback_id: feedback.feedback_id,
      project: feedback.project,
      created_at: feedback.created_at,
      updated_at: feedback.updated_at,
      status: feedback.status,
      owner: feedback.owner,
      uid: feedback.player?.uid || "",
      channel: feedback.player?.channel || "",
      login_version: feedback.player?.login_version || "",
      device: feedback.player?.device || "",
      os: feedback.player?.os || "",
      category: feedback.issue?.category || "",
      sub_category: feedback.issue?.sub_category || "",
      priority: feedback.issue?.priority || "",
      emotion: feedback.issue?.emotion || "",
      risk_flags: (feedback.issue?.risk_flags || []).join(","),
      ai_summary: feedback.issue?.ai_summary || "",
      raw_question: feedback.issue?.raw_question || "",
      entities: JSON.stringify(feedback.issue?.entities || {}),
      field_completeness: feedback.field_completeness || "",
      missing_fields: (feedback.missing_fields || []).join(","),
      duplicate_group_id: feedback.collaboration?.duplicate_group_id || "",
      related_feedback_count: feedback.collaboration?.related_feedback_count || 1,
      handling_note: feedback.collaboration?.handling_note || "",
      resolution: feedback.collaboration?.resolution || "",
      closed_at: feedback.collaboration?.closed_at || "",
      timeline: JSON.stringify(feedback.timeline || []),
    };
  }

  function buildSyncRecord(feedback, result, date = new Date()) {
    const previous = feedback.collaboration || {};
    const retryCount = previous.sync_retry_count || 0;
    const base = {
      ...previous,
      feishu_doc_synced: result.ok,
      sync_status: result.ok ? "success" : "failed",
      sync_retry_count: result.ok ? retryCount : retryCount + 1,
      sync_error_message: result.ok ? "" : result.error_message,
      last_sync_at: formatDateTime(date),
      feishu_record_id: result.record_id || previous.feishu_record_id || "",
      feishu_table: "玩家反馈表",
    };
    return {
      ...feedback,
      updated_at: formatDateTime(date),
      collaboration: base,
    };
  }

  async function syncFeedback(feedback, options = {}) {
    const row = mapFeedbackToFeishuRow(feedback);
    const shouldFail = options.forceFail || false;
    await delay(options.delayMs ?? 180);
    if (shouldFail) {
      return {
        ok: false,
        row,
        error_message: "mock_feishu_network_error",
      };
    }
    return {
      ok: true,
      row,
      record_id: `mock_bitable_${feedback.feedback_id}`,
      error_message: "",
    };
  }

  function getSyncLabel(feedback) {
    const status = feedback.collaboration?.sync_status || "pending";
    const map = {
      pending: "待同步",
      success: "已同步",
      failed: "同步失败",
      retrying: "重试中",
    };
    return map[status] || status;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function formatDateTime(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  global.FeishuAdapter = {
    mapFeedbackToFeishuRow,
    buildSyncRecord,
    syncFeedback,
    getSyncLabel,
  };

  if (typeof module !== "undefined") {
    module.exports = global.FeishuAdapter;
  }
})(typeof window !== "undefined" ? window : globalThis);
