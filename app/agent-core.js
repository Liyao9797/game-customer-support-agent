(function initAgentCore(global) {
  const STATUS_QUERY_PATTERN = /FB\d{12}/i;

  const STATUS_LABELS = {
    draft: "信息收集中",
    submitted: "已提交",
    triaged: "已受理",
    processing: "处理中",
    waiting_player: "待补充信息",
    resolved: "已处理",
    closed: "已关闭",
  };

  const STATUS_FLOW = {
    submitted: ["triaged", "waiting_player"],
    triaged: ["processing", "waiting_player"],
    processing: ["resolved", "waiting_player"],
    waiting_player: ["processing", "closed"],
    resolved: ["closed"],
    closed: [],
  };

  const CATEGORY_OWNER = {
    支付充值: "支付/客服",
    资产道具: "资产/客服",
    活动奖励: "活动运营/客服",
    "游戏 BUG": "客户端/测试",
    账号安全: "账号/客服",
    举报投诉: "风控/客服",
    体验建议: "策划/运营",
    玩法规则: "玩法策划",
    活动规则: "活动运营",
    比赛规则: "赛事运营/客服",
  };

  const FIELD_LABELS = {
    uid: "玩家 UID",
    amount: "充值金额",
    payment_time: "充值时间",
    payment_channel: "支付渠道",
    item: "道具/礼包",
    order_id_or_screenshot: "订单号或支付截图",
    activity_name: "活动名称",
    completed_at: "完成时间",
    expected_reward: "预期奖励",
    actual_result: "实际获得情况",
    asset_type: "资产类型",
    asset_change: "资产变化",
    game_mode_or_scene: "玩法/发生场景",
    screenshot: "截图",
    occurred_at: "发生时间",
    game_mode: "玩法名称",
    table_or_round_id: "牌局 ID",
    app_version: "当前版本",
    device: "设备",
    os: "系统",
    screenshot_or_video: "截图或录屏",
    uid_or_phone_suffix: "UID 或手机号后四位",
    login_method: "登录方式",
    error_message: "异常提示",
    last_success_login_at: "最近正常登录时间",
    reported_user: "被举报玩家",
    report_reason: "举报原因",
    evidence: "证据截图/录屏",
    module: "建议模块",
    current_problem: "当前问题",
    expected_improvement: "期望优化",
    frequency: "出现频率",
    additional_note: "补充说明",
  };

  function normalizeText(text) {
    return String(text || "").trim().toLowerCase();
  }

  function includesAny(text, keywords = []) {
    return keywords.some((keyword) => keyword && text.includes(normalizeText(keyword)));
  }

  function pickHigherPriority(left, right) {
    const rank = { P0: 0, P1: 1, P2: 2, P3: 3 };
    if (!left) return right;
    if (!right) return left;
    return rank[right] < rank[left] ? right : left;
  }

  function detectEmotion(text) {
    if (includesAny(text, ["投诉", "退款", "12315", "发网上", "曝光", "再也不玩"])) {
      return "强烈负面";
    }
    if (includesAny(text, ["气死", "烦死", "太坑", "垃圾", "一直不处理", "离谱"])) {
      return "明显负面";
    }
    if (includesAny(text, ["怎么回事", "不对", "有问题", "没发", "没到", "卡"])) {
      return "轻微负面";
    }
    return "中性";
  }

  function detectEntities(rawText) {
    const text = normalizeText(rawText);
    const semantic = normalizePlayerTerms(rawText);
    const entities = { ...semantic.entities };
    const amount = rawText.match(/(\d+(?:\.\d+)?)\s*(元|块|rmb|人民币)/i);
    const uid = rawText.match(/uid[:：]?\s*(\d{4,})/i);
    const feedbackId = rawText.match(/FB\d{12}/i);
    const gameModes = [
      "黄金牌活动",
      "暗牌玩法",
      "连续加倍玩法",
      "快节奏发牌玩法",
      "三人牌局",
      "快节奏跑牌玩法",
      "组队牌类玩法",
      "连续挑战活动",
      "每日签到",
      "新手赛事",
      "自建赛",
      "大米赛",
    ];

    if (amount) {
      entities.amount = Number(amount[1]);
      entities.real_money_amount = Number(amount[1]);
      entities.resource_type = "real_money";
    }
    if (uid) entities.uid = uid[1];
    if (feedbackId) entities.feedback_id = feedbackId[0].toUpperCase();
    for (const mode of gameModes) {
      if (text.includes(normalizeText(mode))) {
        entities.game_mode = mode;
        if (mode.includes("赛")) entities.activity_name = mode;
        if (mode === "连续挑战活动" || mode === "每日签到") entities.activity_name = mode;
      }
    }
    const timePhrase = extractTimePhrase(rawText);
    if (timePhrase) entities.occurred_at = timePhrase;
    const roundId = extractRoundOrTableId(rawText);
    if (roundId) entities.table_or_round_id = roundId;
    const evidence = extractEvidenceHint(rawText);
    if (evidence) {
      entities.screenshot_or_video = evidence;
      entities.screenshot = evidence;
      entities.evidence = evidence;
    }
    if (includesAny(text, ["第9轮", "第 9 轮"])) entities.challenge_round = "第9轮";
    if (includesAny(text, ["称号"])) entities.expected_reward = "称号奖励";
    if (includesAny(text, ["鱼票"])) entities.expected_reward = "鱼票";
    if (includesAny(text, ["礼包"])) entities.item = "礼包";
    if (includesAny(text, ["道具"])) entities.item = "道具";
    if (includesAny(text, ["app store", "苹果"])) entities.payment_channel = "App Store";
    if (includesAny(text, ["微信"])) entities.payment_channel = "微信支付";
    if (includesAny(text, ["支付宝"])) entities.payment_channel = "支付宝";
    return entities;
  }

  function extractTimePhrase(rawText) {
    const text = normalizeText(rawText);
    const patterns = [
      /昨晚\s*\d{1,2}\s*点(?:\d{1,2}\s*分)?/,
      /昨天\s*(?:晚上|下午|上午)?\s*\d{1,2}\s*点(?:\d{1,2}\s*分)?/,
      /今天\s*(?:晚上|下午|上午)?\s*\d{1,2}\s*点(?:\d{1,2}\s*分)?/,
      /刚刚/,
      /昨天/,
      /今天/,
    ];
    for (const pattern of patterns) {
      const match = rawText.match(pattern);
      if (match) return match[0].replace(/\s+/g, "");
    }
    if (text.includes("刚才")) return "刚刚";
    return "";
  }

  function extractRoundOrTableId(rawText) {
    const patterns = [
      /牌局\s*(?:id|ID|号)?[:：]?\s*(\d{4,})/,
      /房间\s*(?:id|ID|号)?[:：]?\s*(\d{4,})/,
      /桌号[:：]?\s*(\d{4,})/,
      /第\s*(\d+)\s*轮/,
    ];
    for (const pattern of patterns) {
      const match = rawText.match(pattern);
      if (match) return pattern.source.includes("\\s*轮") ? `第${match[1]}轮` : match[1];
    }
    return "";
  }

  function extractEvidenceHint(rawText) {
    const text = normalizeText(rawText);
    if (includesAny(text, ["有录屏", "录屏了", "视频"])) return "有录屏";
    if (includesAny(text, ["有截图", "截图了", "发截图", "支付截图"])) return "有截图";
    return "";
  }

  function normalizePlayerTerms(rawText) {
    const text = normalizeText(rawText);
    const entities = {};
    const resourceTerms = [];
    const gameCurrencyAliases = ["欢乐豆", "金币", "金豆", "豆子", "豆", "游戏币"];
    const premiumCurrencyAliases = ["钻石"];
    const allGameAssetAliases = [...premiumCurrencyAliases, ...gameCurrencyAliases];
    const paymentContextTerms = ["充值", "充了", "充钱", "支付", "订单", "扣费", "退款", "不到账", "没到账", "未到账"];
    const gameAssetContextTerms = ["结算", "牌局", "对局", "输赢", "赢了", "输了", "奖励", "道具", "背包", "金币", "欢乐豆", "豆子", "游戏币", "钻石"];
    const realMoneyTerms = ["人民币", "rmb", "现实钱", "现金"];

    for (const alias of gameCurrencyAliases) {
      if (text.includes(normalizeText(alias))) resourceTerms.push(alias);
    }
    for (const alias of premiumCurrencyAliases) {
      if (text.includes(normalizeText(alias))) resourceTerms.push(alias);
    }

    if (resourceTerms.length) {
      entities.resource_terms = Array.from(new Set(resourceTerms));
      const hasPremiumCurrency = entities.resource_terms.some((term) => premiumCurrencyAliases.includes(term));
      const hasGameCurrency = entities.resource_terms.some((term) => gameCurrencyAliases.includes(term));
      if (hasPremiumCurrency && hasGameCurrency) {
        entities.resource_type = "mixed_game_asset";
        entities.normalized_resource = "钻石/游戏内金币";
      } else if (hasPremiumCurrency) {
        entities.resource_type = "premium_currency";
        entities.normalized_resource = "钻石";
      } else {
        entities.resource_type = "game_currency";
        entities.normalized_resource = "游戏内金币";
      }
    }

    const gameCurrencyAmount = extractResourceAmount(rawText, gameCurrencyAliases);
    if (gameCurrencyAmount != null) {
      entities.game_currency_amount = gameCurrencyAmount;
    }
    const premiumCurrencyAmount = extractResourceAmount(rawText, premiumCurrencyAliases);
    if (premiumCurrencyAmount != null) {
      entities.premium_currency_amount = premiumCurrencyAmount;
    }

    if (text.includes("兑换")) entities.asset_context = "exchange";
    if (text.includes("钻石") && includesAny(text, ["买金币", "购买金币", "换金币", "兑换金币"])) {
      entities.asset_context = "diamond_to_coin";
      entities.resource_type = "mixed_game_asset";
      entities.normalized_resource = "钻石/游戏内金币";
    }

    const realMoney = rawText.match(/(\d+(?:\.\d+)?)\s*(元|块|rmb|人民币)/i);
    if (realMoney) {
      entities.real_money_amount = Number(realMoney[1]);
      entities.resource_type = "real_money";
      entities.money_context = "payment";
    }
    if (!resourceTerms.length && includesAny(text, realMoneyTerms)) {
      entities.resource_type = "real_money";
      entities.money_context = "payment";
      delete entities.money_ambiguous;
    }

    const mentionsMoney = text.includes("钱");
    if (mentionsMoney && !realMoney && !resourceTerms.length && entities.resource_type !== "real_money") {
      const hasPaymentContext = includesAny(text, paymentContextTerms);
      const hasGameAssetContext = includesAny(text, gameAssetContextTerms);
      if (hasPaymentContext && !hasGameAssetContext) {
        entities.resource_type = "real_money";
        entities.money_context = "payment";
      } else if (hasGameAssetContext && !hasPaymentContext) {
        entities.resource_type = "game_currency";
        entities.money_context = "game_asset";
        entities.normalized_resource = "游戏内金币";
      } else {
        entities.resource_type = "ambiguous_money";
        entities.money_ambiguous = true;
      }
    }

    return {
      normalized_text: text,
      entities,
    };
  }

  function extractResourceAmount(rawText, resourceAliases) {
    const aliasPattern = resourceAliases.join("|");
    const patterns = [
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*([wW万kK千])\\s*(?:${aliasPattern})`),
      new RegExp(`(?:${aliasPattern})\\s*(?:少了|没了|少|扣了|掉了)?\\s*(\\d+(?:\\.\\d+)?)\\s*([wW万kK千]?)`),
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*([wW万kK千]?)\\s*(?:${aliasPattern})`),
    ];
    for (const pattern of patterns) {
      const match = rawText.match(pattern);
      if (!match) continue;
      const value = Number(match[1]);
      const unit = match[2] || "";
      if (Number.isFinite(value)) return scaleNumberByUnit(value, unit);
    }
    return null;
  }

  function scaleNumberByUnit(value, unit) {
    const normalizedUnit = String(unit || "").toLowerCase();
    if (normalizedUnit === "w" || normalizedUnit === "万") return value * 10000;
    if (normalizedUnit === "k" || normalizedUnit === "千") return value * 1000;
    return value;
  }

  function classifyMessage(rawText, rules) {
    const text = normalizeText(rawText);
    const entities = detectEntities(rawText);
    const riskFlags = [];
    let priorityHint = "P3";

    if (STATUS_QUERY_PATTERN.test(rawText) || includesAny(text, rules.status_query_keywords || [])) {
      return {
        intent: "check_status",
        category: "进度查询",
        sub_category: "",
        entities,
        emotion: detectEmotion(text),
        risk_flags: [],
        priority_hint: "P3",
        next_action: "check_feedback_status",
        confidence: 0.9,
      };
    }

    for (const risk of rules.risk_rules || []) {
      if (includesAny(text, risk.keywords)) {
        riskFlags.push(risk.risk_flag);
        priorityHint = pickHigherPriority(priorityHint, risk.priority);
      }
    }

    const feedbackSignals = ["没到账", "不到账", "没发", "没给", "没收到", "异常", "错了", "补发", "退", "投诉"];
    const categoryMatches = [];
    for (const categoryRule of rules.categories || []) {
      const hitCount = (categoryRule.keywords || []).filter((keyword) =>
        text.includes(normalizeText(keyword)),
      ).length;
      if (hitCount > 0) categoryMatches.push({ ...categoryRule, hitCount });
    }

    const paymentAnchor = includesAny(text, ["充值", "扣费", "订单", "支付", "退款", "误充", "未成年人"]);
    const realPaymentAnchor = Boolean(entities.real_money_amount || entities.payment_channel || entities.resource_type === "real_money");
    const rewardAnchor = includesAny(text, ["奖励", "活动", "比赛", "签到", "称号", "礼包", "新手赛事", "大米赛", "连续挑战活动"]);
    const hasFeedbackSignal = includesAny(text, feedbackSignals);
    const assetRoute = buildAssetRoute(text, entities, categoryMatches);

    let selected = null;
    if (realPaymentAnchor) {
      selected = categoryMatches.find((item) => item.category === "支付充值") || {
        category: "支付充值",
        default_intent: "submit_feedback",
        default_priority: "P0",
        required_fields: ["uid", "amount", "payment_time", "payment_channel", "item", "order_id_or_screenshot"],
        next_action: "ask_clarification",
        hitCount: 1,
      };
    }

    if (!selected && assetRoute && !realPaymentAnchor && !paymentAnchor && !rewardAnchor) {
      selected = assetRoute;
    }

    if (!selected && !paymentAnchor && rewardAnchor) {
      selected = categoryMatches.find((item) => item.category === "活动奖励");
      if (!selected && hasFeedbackSignal) {
        selected = {
          category: "活动奖励",
          default_intent: "submit_feedback",
          default_priority: "P1",
          required_fields: ["uid", "activity_name", "completed_at", "expected_reward", "screenshot"],
          next_action: "ask_clarification",
          hitCount: 1,
        };
      }
    }

    if (!selected && assetRoute && !realPaymentAnchor && entities.resource_type !== "real_money" && !rewardAnchor) {
      selected = assetRoute;
    }

    if (!selected && entities.resource_type === "ambiguous_money") {
      return {
        intent: "unclear",
        category: "未识别",
        sub_category: "",
        entities,
        emotion: detectEmotion(text),
        risk_flags: riskFlags,
        priority_hint: priorityHint,
        next_action: "ask_clarification",
        confidence: 0.35,
      };
    }

    if (!selected) {
      selected = categoryMatches
        .filter((item) => item.default_intent === "submit_feedback")
        .sort((a, b) => b.hitCount - a.hitCount)[0];
    }

    if (!selected && assetRoute && hasFeedbackSignal && !realPaymentAnchor && entities.resource_type !== "real_money" && !rewardAnchor) {
      selected = assetRoute;
    }

    if (!selected && hasFeedbackSignal) {
      selected = categoryMatches.find((item) => item.category === "活动奖励") || {
        category: "游戏 BUG",
        default_intent: "submit_feedback",
        default_priority: "P2",
        required_fields: ["uid", "occurred_at", "game_mode", "table_or_round_id", "screenshot_or_video"],
        next_action: "ask_clarification",
      };
    }

    if (!selected) {
      selected = categoryMatches.sort((a, b) => b.hitCount - a.hitCount)[0];
    }

    if (!selected) {
      return {
        intent: "unclear",
        category: "未识别",
        sub_category: "",
        entities,
        emotion: detectEmotion(text),
        risk_flags: riskFlags,
        priority_hint: priorityHint,
        next_action: "ask_clarification",
        confidence: 0.35,
      };
    }

    priorityHint = pickHigherPriority(priorityHint, selected.default_priority);
    const intent = selected.default_intent;
    const nextAction = intent === "knowledge_query" && !hasFeedbackSignal
      ? "answer_from_kb"
      : selected.next_action || "ask_clarification";

    return {
      intent: hasFeedbackSignal && intent === "knowledge_query" ? "submit_feedback" : intent,
      category: selected.category,
      sub_category: selected.sub_category_override || inferSubCategory(text, selected.category),
      entities,
      emotion: detectEmotion(text),
      risk_flags: riskFlags,
      priority_hint: priorityHint,
      next_action: hasFeedbackSignal && intent === "knowledge_query" ? "ask_clarification" : nextAction,
      confidence: Math.min(0.95, 0.55 + (selected.hitCount || 1) * 0.12 + riskFlags.length * 0.08),
      required_fields: selected.required_fields || [],
    };
  }

  function buildAssetRoute(text, entities, categoryMatches) {
    const resourceType = entities.resource_type;
    if (!["game_currency", "premium_currency", "mixed_game_asset"].includes(resourceType)) return null;
    const assetRule = categoryMatches.find((item) => item.category === "资产道具") || {
      category: "资产道具",
      default_intent: "submit_feedback",
      default_priority: "P1",
      required_fields: ["uid", "asset_type", "asset_change", "game_mode_or_scene", "occurred_at", "screenshot_or_video"],
      next_action: "ask_clarification",
      hitCount: 1,
    };
    return {
      ...assetRule,
      hitCount: Math.max(assetRule.hitCount || 1, 1),
      sub_category_override: inferAssetSubCategory(text, entities),
    };
  }

  function inferSubCategory(text, category) {
    if (category === "支付充值") {
      if (includesAny(text, ["重复扣"])) return "重复扣费";
      if (includesAny(text, ["退款", "误充", "未成年人"])) return "退款/未成年人支付";
      return "充值成功但道具未到账";
    }
    if (category === "活动奖励") return "奖励未到账";
    if (category === "资产道具") return "资产异常";
    if (category === "游戏 BUG") {
      if (includesAny(text, ["结算"])) return "结算异常";
      if (includesAny(text, ["闪退", "卡死", "黑屏"])) return "闪退/卡死";
      return "游戏异常";
    }
    if (category === "举报投诉") return "举报玩家";
    if (category === "账号安全") return "登录/账号异常";
    if (category === "体验建议") return "体验建议";
    return "";
  }

  function inferAssetSubCategory(text, entities) {
    if (entities.asset_context === "diamond_to_coin") return "钻石购买金币异常";
    if (entities.asset_context === "exchange" && entities.resource_type === "premium_currency") return "钻石兑换异常";
    if (includesAny(text, ["结算", "牌局", "对局", "这局", "赢了没加", "输了多扣"])) return "结算后资产异常";
    if (entities.resource_type === "game_currency") return "金币异常";
    if (entities.resource_type === "premium_currency") return "钻石异常";
    if (entities.resource_type === "mixed_game_asset") return "资产兑换异常";
    return "资产异常";
  }

  function scoreKnowledge(rawText, item) {
    const text = normalizeText(rawText);
    let score = 0;
    if (text.includes(normalizeText(item.topic))) score += 10;
    for (const tag of item.tags || []) {
      if (text.includes(normalizeText(tag))) score += 4;
    }
    for (const q of item.common_questions || []) {
      const normalizedQuestion = normalizeText(q);
      if (text === normalizedQuestion) score += 12;
      if (text.includes(normalizedQuestion) || normalizedQuestion.includes(text)) score += 6;
      for (const token of extractChineseTerms(normalizedQuestion)) {
        if (text.includes(token)) score += 1;
      }
    }
    return score;
  }

  function extractChineseTerms(text) {
    return Array.from(new Set(String(text).match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g) || []));
  }

  function retrieveKnowledge(rawText, knowledgeBase, limit = 3) {
    return knowledgeBase
      .map((item) => ({ item, score: scoreKnowledge(rawText, item) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function buildKnowledgeAnswer(rawText, route, matches) {
    if (!matches.length) {
      return {
        type: "text",
        content:
          "这个问题我暂时没有在当前知识库里找到确定规则。您可以补充具体玩法、活动名称或截图，我会继续帮您整理；如果涉及个人奖励或牌局争议，也可以提交反馈给客服核查。",
        references: [],
      };
    }

    const top = matches[0].item;
    const needsBoundary =
      top.source_status !== "完整" ||
      includesAny(normalizeText(rawText), ["这局", "没给", "没到账", "没发", "算错", "奖励"]);
    let content = top.answer;
    if (needsBoundary) {
      content += `\n\n边界说明：${top.no_answer_boundary || "具体权益、奖励和单局结算需以游戏内页面或后台核查为准。"}`;
    }
    return {
      type: "text",
      content,
      references: matches.map(({ item, score }) => ({
        knowledge_id: item.knowledge_id,
        topic: item.topic,
        score,
      })),
      route,
    };
  }

  function createFeedbackDraft(rawText, route) {
    const requiredFields = route.required_fields || defaultRequiredFields(route.category);
    const collectedFields = prefillFeedbackFields(rawText, route);
    const missingFields = requiredFields.filter((field) => !collectedFields[field]);
    return {
      project: "示例棋牌项目",
      source: "game_webview",
      status: "draft",
      category: route.category,
      sub_category: route.sub_category || inferSubCategory(normalizeText(rawText), route.category),
      raw_question: rawText,
      ai_summary: summarizeIssue(rawText, route),
      priority: route.priority_hint,
      required_fields: requiredFields,
      collected_fields: collectedFields,
      missing_fields: missingFields,
      risk_flags: route.risk_flags,
      confidence: route.confidence,
    };
  }

  function prefillFeedbackFields(rawText, route) {
    const entities = { ...(route.entities || {}) };
    const fields = { ...entities };
    if (route.category === "支付充值") {
      if (!fields.payment_time && entities.occurred_at) fields.payment_time = entities.occurred_at;
    }
    if (route.category === "活动奖励") {
      if (!fields.completed_at && entities.occurred_at) fields.completed_at = entities.occurred_at;
    }
    if (route.category === "资产道具") {
      if (!fields.asset_type && entities.normalized_resource) {
        fields.asset_type = entities.normalized_resource;
      }
      if (!fields.asset_change) {
        fields.asset_change = summarizeAssetChange(rawText, entities);
      }
      if (!fields.game_mode_or_scene && entities.asset_context) {
        fields.game_mode_or_scene = formatAssetContext(entities.asset_context);
      }
    }
    return fields;
  }

  function summarizeAssetChange(rawText, entities) {
    const text = normalizeText(rawText);
    if (entities.game_currency_amount != null) {
      const action = includesAny(text, ["少", "没了", "扣了", "掉了"]) ? "少了" : "涉及";
      return `${action} ${entities.game_currency_amount} 游戏内金币`;
    }
    if (entities.premium_currency_amount != null) {
      const action = includesAny(text, ["少", "没了", "扣了", "掉了"]) ? "少了" : "涉及";
      return `${action} ${entities.premium_currency_amount} 钻石`;
    }
    if (entities.asset_context === "diamond_to_coin") {
      return "钻石已扣但金币未到账";
    }
    if (includesAny(text, ["道具没发", "没发", "没给", "没到账"])) {
      return "资产或道具未到账";
    }
    return "";
  }

  function formatAssetContext(assetContext) {
    const map = {
      exchange: "兑换",
      diamond_to_coin: "钻石购买金币",
    };
    return map[assetContext] || assetContext;
  }

  function defaultRequiredFields(category) {
    const map = {
      支付充值: ["uid", "amount", "payment_time", "payment_channel", "item", "order_id_or_screenshot"],
      活动奖励: ["uid", "activity_name", "completed_at", "expected_reward", "screenshot"],
      资产道具: ["uid", "asset_type", "asset_change", "game_mode_or_scene", "occurred_at", "screenshot_or_video"],
      "游戏 BUG": ["uid", "occurred_at", "game_mode", "table_or_round_id", "app_version", "device", "os", "screenshot_or_video"],
      账号安全: ["uid_or_phone_suffix", "login_method", "device", "error_message", "last_success_login_at"],
      举报投诉: ["reported_user", "table_or_round_id", "occurred_at", "report_reason", "evidence"],
      体验建议: ["module", "current_problem", "expected_improvement", "frequency"],
    };
    return map[category] || ["uid", "screenshot"];
  }

  function summarizeIssue(rawText, route) {
    const category = route.category || "未识别";
    const sub = route.sub_category ? `/${route.sub_category}` : "";
    return `玩家反馈${category}${sub}问题：${rawText}`;
  }

  function buildClarification(draft) {
    const labels = draft.missing_fields.map((field) => FIELD_LABELS[field] || field);
    const prefixMap = {
      支付充值: "为了帮您核查充值问题，请补充",
      资产道具: "我可以帮您提交资产道具反馈。请补充",
      活动奖励: "我可以帮您提交活动奖励反馈。请补充",
      "游戏 BUG": "这个问题需要结合牌局或设备信息排查。请补充",
      账号安全: "账号问题需要人工核查。请补充",
      举报投诉: "我可以帮您提交举报反馈。请补充",
      体验建议: "收到您的建议。请补充",
    };
    return `${prefixMap[draft.category] || "请补充"}：${labels.slice(0, 5).join("、")}。`;
  }

  function buildFallbackClarification(rawText, route = {}) {
    const text = normalizeText(rawText);
    const entities = route.entities || detectEntities(rawText);
    if (entities.money_ambiguous || includesAny(text, ["钱没了", "钱少了", "扣了钱"])) {
      return "我先帮您确认一下：您说的钱，是人民币充值/扣款问题，还是金币、钻石这类游戏资产变少了？";
    }
    if (includesAny(text, ["奖励没给", "奖励没发", "奖励没到账", "没给奖励"])) {
      return "收到，我先帮您确认奖励来源：这是活动/比赛奖励未到账，还是对局结算奖励有争议？您可以直接说活动名、比赛名，或回复“对局结算”。";
    }
    if (includesAny(text, ["卡了", "卡住", "卡死", "进不去", "打不开"])) {
      return "我先帮您确认发生场景：是在登录/进房间卡住、对局中卡住，还是支付/领取奖励时卡住？";
    }
    if (includesAny(text, ["没到账", "不到账", "没发", "没给"])) {
      return "我先帮您确认是哪类未到账：充值购买、活动奖励、钻石/金币/道具，还是对局结算？";
    }
    return "我先帮您看一下，请先选一个方向：充值/资产、活动奖励、卡顿/BUG、举报投诉，还是玩法规则？";
  }

  function makeFeedbackId(date = new Date(), serial = 1) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `FB${yyyy}${mm}${dd}${String(serial).padStart(4, "0")}`;
  }

  function submitFeedback(draft, serial = 1, date = new Date()) {
    const now = formatDateTime(date);
    const completeness = getFieldCompleteness(draft);
    return {
      feedback_id: makeFeedbackId(date, serial),
      project: "示例棋牌项目",
      source: draft.source || "game_webview",
      created_at: now,
      updated_at: now,
      status: "submitted",
      owner: CATEGORY_OWNER[draft.category] || "客服",
      field_completeness: completeness.level,
      missing_fields: draft.missing_fields || [],
      required_fields: draft.required_fields || [],
      timeline: [
        {
          status: "submitted",
          at: now,
          note: completeness.level === "low" ? "玩家已提交，信息不完整，需客服二次沟通。" : "玩家已确认提交反馈。",
        },
      ],
      player: {
        uid: draft.collected_fields.uid || "",
        channel: "",
        login_version: draft.collected_fields.app_version || "",
        device: draft.collected_fields.device || "",
        os: draft.collected_fields.os || "",
      },
      issue: {
        raw_question: draft.raw_question,
        category: draft.category,
        sub_category: draft.sub_category,
        ai_summary: draft.ai_summary,
        intent: "提交反馈",
        entities: draft.collected_fields,
        emotion: draft.emotion || "轻微负面",
        risk_flags: draft.risk_flags || [],
        priority: draft.priority,
        confidence: draft.confidence || 0.75,
      },
      collaboration: {
        feishu_doc_synced: false,
        feishu_group_notified: false,
        notification_level: draft.priority === "P0" ? "all" : draft.priority === "P1" ? "owner" : "none",
        duplicate_group_id: "",
        related_feedback_count: 1,
        handling_note: "",
        resolution: "",
        closed_at: "",
      },
    };
  }

  function getFieldCompleteness(draft) {
    const requiredCount = draft.required_fields?.length || 0;
    if (!requiredCount) return { level: "high", ratio: 1 };
    const missingCount = draft.missing_fields?.length || 0;
    const ratio = (requiredCount - missingCount) / requiredCount;
    if (ratio >= 0.8) return { level: "high", ratio };
    if (ratio >= 0.45) return { level: "medium", ratio };
    return { level: "low", ratio };
  }

  function transitionFeedbackStatus(feedback, nextStatus, note = "", date = new Date()) {
    const allowed = STATUS_FLOW[feedback.status] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(`状态 ${feedback.status} 不能流转到 ${nextStatus}`);
    }
    const now = formatDateTime(date);
    const updated = {
      ...feedback,
      status: nextStatus,
      updated_at: now,
      timeline: [
        ...(feedback.timeline || []),
        {
          status: nextStatus,
          at: now,
          note: note || defaultStatusNote(nextStatus),
        },
      ],
    };
    if (nextStatus === "closed") {
      updated.closed_at = now;
      updated.collaboration = {
        ...updated.collaboration,
        closed_at: now,
      };
    }
    return updated;
  }

  function defaultStatusNote(status) {
    const map = {
      triaged: "系统已完成分类和优先级判断。",
      processing: "负责人已开始处理。",
      waiting_player: "等待玩家补充排查信息。",
      resolved: "反馈已有处理结论。",
      closed: "反馈已关闭。",
    };
    return map[status] || "状态已更新。";
  }

  function getNextStatuses(status) {
    return STATUS_FLOW[status] || [];
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[status] || status;
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

  function getFieldLabels(fields) {
    return fields.map((field) => FIELD_LABELS[field] || field);
  }

  global.AgentCore = {
    classifyMessage,
    retrieveKnowledge,
    buildKnowledgeAnswer,
    createFeedbackDraft,
    buildClarification,
    buildFallbackClarification,
    submitFeedback,
    transitionFeedbackStatus,
    getNextStatuses,
    getStatusLabel,
    makeFeedbackId,
    getFieldLabels,
    detectEntities,
    normalizePlayerTerms,
  };

  if (typeof module !== "undefined") {
    module.exports = global.AgentCore;
  }
})(typeof window !== "undefined" ? window : globalThis);
