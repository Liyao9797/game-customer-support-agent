# Agent MVP 自动评测报告

评测日期：2026-06-05  
评测对象：示例棋牌项目客服 Agent MVP  
评测范围：规则问答、活动问答、反馈分类、模糊词消歧、风险识别、进度查询

## 1. 评测结论

本轮自动评测通过。

```text
Agent MVP evaluation: 18/18 passed
```

当前版本已经可以作为语义理解优化后的可验证基线。

## 2. 覆盖能力

| 能力 | 覆盖用例 | 结果 |
| --- | --- | --- |
| 规则问答 | 王炸/炸弹、暗牌炸弹、黄金牌活动压制关系 | 通过 |
| 活动问答 | 连续挑战活动鱼票清空规则 | 通过 |
| 支付充值 | 30 元不到账、投诉 12315 | 通过 |
| 活动奖励 | 新手赛事奖励、泛化奖励未发 | 通过 |
| 游戏 BUG | 对局卡死、强负面卡死反馈 | 通过 |
| 举报投诉 | 开挂/骂人 | 通过 |
| 体验建议 | 匹配太慢 | 通过 |
| 模糊词消歧 | 欢乐豆、钱没了、金币结算争议 | 通过 |
| 进度查询 | 反馈编号查询、无编号查询 | 通过 |

## 3. 本轮修复项

| 问题 | 修复方式 |
| --- | --- |
| “金币少了，这局赢了没加”子类不够准确 | 增加“这局、赢了没加、输了多扣”等结算后资产异常判断 |
| “奖励又没发”误判为 BUG | 仅在明确反馈信号下，将泛化奖励问题兜底到活动奖励 |
| “烦死了”情绪识别偏弱 | 将“烦死”纳入明显负面情绪词 |
| 活动规则被误当活动奖励反馈 | 收窄活动奖励兜底边界，普通规则问题继续走知识库 |

## 4. 自动验证命令

```bash
node scripts/evaluate_agent_mvp.js
node scripts/smoke_agent.js
node scripts/smoke_asset_classification.js
node scripts/smoke_semantic_normalization.js
node scripts/smoke_player_feedback_steps.js
node scripts/smoke_player_prefill_steps.js
node scripts/smoke_prefill_feedback_fields.js
node scripts/smoke_prefill_more_fields.js
node scripts/smoke_unclear_clarification.js
node scripts/smoke_pages.js
node scripts/smoke_player_quick_entry.js
node scripts/smoke_two_sided.js
node scripts/smoke_knowledge_brief.js
node scripts/smoke_feishu.js
```

## 5. 仍需人工验收

自动评测只能检查分类、字段、路由和关键答案，以下部分仍建议人工评估：

- 回复是否足够自然、有安抚感。
- 玩家端手机 WebView 视觉是否有客服产品质感。
- 强负面玩家连续追问时，话术是否稳定、不激化情绪。
- 反馈确认卡里的摘要是否容易被玩家理解。

建议下一轮人工测试 5 条：

| 测试问题 | 人工观察重点 |
| --- | --- |
| 气死了，我充值 30 元没到账 | 是否先安抚，再引导补订单 |
| 你们这游戏太坑了，奖励又没发 | 是否降低对抗感 |
| 一直卡死，烦死了 | 是否承认体验受影响 |
| 钱没了 | 是否先消歧，不乱归类 |
| 金币少了，这局赢了没加 | 是否按结算争议收集牌局证据 |
