# 反馈结构化字段设计

## 1. 设计目标

反馈字段需要同时服务玩家进度查询、客服处理、团队协同、问题聚合、日报统计和后续知识库优化。MVP 阶段优先采用统一 JSON 结构，后续可映射到数据库表、飞书多维表格或工单系统。

## 2. 反馈 ID 规则

格式：

```text
FB + YYYYMMDD + 4 位自增序号
```

示例：

```text
FB202605250001
```

生成规则：

- 按项目和日期维度自增。
- 同一天从 0001 开始。
- 展示给玩家时保留完整 ID。

## 3. 状态流转

| 状态 | 含义 | 对玩家展示 |
| --- | --- | --- |
| draft | Agent 正在收集信息，尚未提交 | 信息收集中 |
| submitted | 玩家已确认提交 | 已提交 |
| triaged | 已完成分类和优先级判断 | 已受理 |
| processing | 负责人处理中 | 处理中 |
| waiting_player | 等待玩家补充信息 | 待补充信息 |
| resolved | 已处理并有结论 | 已处理 |
| closed | 已关闭 | 已关闭 |

## 4. 基础字段

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| feedback_id | string | 反馈编号 | FB202605250001 |
| project | string | 项目名称 | 示例棋牌项目 |
| source | string | 来源入口 | game_webview |
| created_at | datetime | 创建时间 | 2026-05-25 10:30:00 |
| updated_at | datetime | 更新时间 | 2026-05-25 10:35:00 |
| status | string | 处理状态 | submitted |
| owner | string | 当前负责人 | 支付后端值班 |

## 5. 玩家信息字段

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| uid | string | 玩家 UID | 123456789 |
| channel | string | 渠道 | App Store |
| register_time | date | 注册时间 | 2026-01-18 |
| register_version | string | 注册版本 | 1.2.0 |
| login_version | string | 当前版本 | 1.5.3 |
| device | string | 设备 | iPhone 15 |
| os | string | 系统 | iOS 18 |
| player_segment | string | 玩家分层 | 高活跃/付费玩家 |

## 6. 问题理解字段

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| raw_question | string | 玩家原始问题 | 我充值了 30 元没到账 |
| category | string | 问题分类 | 支付充值 |
| sub_category | string | 问题子类 | 充值成功但道具未到账 |
| ai_summary | string | AI 摘要 | 玩家反馈充值后欢乐豆未到账，需要核查订单 |
| intent | string | 玩家意图 | 查询到账/提交反馈 |
| entities | object | 关键信息 | {"amount":30,"item":"欢乐豆"} |
| emotion | string | 情绪 | 明显负面 |
| risk_flags | string[] | 风险标签 | ["payment","manual_review"] |
| priority | string | 优先级 | P0 |
| confidence | number | 分类置信度 | 0.86 |

## 7. 协同字段

| 字段 | 类型 | 说明 | 示例 |
| --- | --- | --- | --- |
| feishu_doc_synced | boolean | 是否同步飞书文档 | true |
| feishu_group_notified | boolean | 是否已群通知 | true |
| notification_level | string | 通知等级 | all |
| duplicate_group_id | string | 聚合问题 ID | DG20260525001 |
| related_feedback_count | number | 同类反馈数 | 37 |
| handling_note | string | 处理记录 | 支付链路排查中 |
| resolution | string | 处理结论 | 已补发到账 |
| closed_at | datetime | 关闭时间 | 2026-05-25 12:00:00 |

## 8. 场景追问字段

### 8.1 支付充值

必填信息：

- 玩家 UID。
- 充值金额。
- 充值时间。
- 支付渠道。
- 购买道具或礼包。
- 订单号或支付截图。

建议追问：

```text
为了帮你核查到账情况，请补充充值金额、充值时间、支付渠道，以及订单号或支付截图。
```

### 8.2 资产道具

适用边界：

- 玩家说人民币、元、扣款、退款、订单时，优先归为支付充值。
- 玩家说钻石、金币、欢乐豆、豆子、游戏币、道具数量变化时，归为资产道具。
- 玩家只说“钱没了”但无法判断是人民币还是游戏资产时，先追问确认。

必填信息：

- 玩家 UID。
- 资产类型，例如钻石、金币、欢乐豆或具体道具。
- 资产变化，例如少了多少、扣了什么、没到账什么。
- 发生场景，例如兑换、商城购买、结算后或某个玩法里。
- 发生时间。
- 截图或录屏。

建议追问顺序：

```text
我先帮你记录资产问题。先发一下玩家 UID 就好，后面我会一步一步问，不用一次全填。
```

### 8.3 活动奖励

必填信息：

- 玩家 UID。
- 活动名称。
- 完成时间。
- 预期奖励。
- 实际获得情况。
- 截图。

### 8.4 游戏 BUG

必填信息：

- 玩家 UID。
- 发生时间。
- 发生玩法或场景。
- 牌局 ID 或房间信息。
- 当前版本。
- 设备和系统。
- 截图或录屏。

### 8.5 账号安全

必填信息：

- UID 或绑定手机号后四位。
- 登录渠道。
- 设备。
- 异常提示。
- 最近一次可正常登录时间。

### 8.6 举报投诉

必填信息：

- 被举报玩家昵称或 UID。
- 牌局 ID。
- 发生时间。
- 举报原因。
- 截图或录屏。

### 8.7 体验建议

必填信息：

- 建议模块。
- 当前体验问题。
- 期望优化方向。
- 影响频率。

## 9. JSON 示例

```json
{
  "feedback_id": "FB202605250001",
  "project": "示例棋牌项目",
  "source": "game_webview",
  "created_at": "2026-05-25 10:30:00",
  "updated_at": "2026-05-25 10:30:00",
  "status": "submitted",
  "owner": "支付/客服",
  "player": {
    "uid": "123456789",
    "channel": "App Store",
    "register_time": "2026-01-18",
    "register_version": "1.2.0",
    "login_version": "1.5.3",
    "device": "iPhone 15",
    "os": "iOS 18",
    "player_segment": "高活跃/付费玩家"
  },
  "issue": {
    "raw_question": "我充值了 30 元没到账",
    "category": "支付充值",
    "sub_category": "充值成功但道具未到账",
    "ai_summary": "玩家反馈充值后欢乐豆未到账，需要核查订单。",
    "intent": "提交反馈",
    "entities": {
      "amount": 30,
      "currency": "CNY",
      "item": "欢乐豆",
      "payment_channel": "App Store"
    },
    "emotion": "明显负面",
    "risk_flags": ["payment", "manual_review"],
    "priority": "P0",
    "confidence": 0.86
  },
  "collaboration": {
    "feishu_doc_synced": true,
    "feishu_group_notified": true,
    "notification_level": "all",
    "duplicate_group_id": "DG20260525001",
    "related_feedback_count": 37,
    "handling_note": "支付链路排查中",
    "resolution": "",
    "closed_at": ""
  }
}
```

## 10. 飞书多维表格字段建议

MVP 表格可拆为 3 组视图：

- 客服视图：反馈 ID、玩家 UID、问题摘要、状态、负责人、处理记录、处理结论。
- 产品运营视图：分类、子类、标签、优先级、反馈数量、版本、渠道、情绪。
- 技术排查视图：设备、系统、版本、发生场景、牌局 ID、截图、复现情况。
