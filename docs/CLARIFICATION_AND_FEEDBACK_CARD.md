# 追问策略与反馈确认卡

更新时间：2026-05-27  
用途：定义 Agent 在信息不足时如何追问，以及何时生成反馈确认卡。

## 1. 追问原则

- 一次最多追问 3-5 个关键字段，避免玩家负担过重。
- 优先问能定位问题的字段：UID、时间、活动/玩法名称、截图、牌局 ID、订单号。
- 能从上下文提取的字段不要重复问。
- 对支付、账号、举报、未成年人等问题，明确说明需要人工核查。

## 2. 场景追问模板

### 2.1 支付充值

触发示例：

- 我充了 30 元没到账。
- 重复扣费了。
- 孩子误充了。

追问：

```text
为了帮你核查充值问题，请补充：充值金额、充值时间、支付渠道、购买的道具或礼包，以及订单号或支付截图。
```

必收字段：

- uid
- amount
- payment_time
- payment_channel
- item
- order_id_or_screenshot

### 2.2 活动奖励

追问：

```text
我可以帮你提交活动奖励反馈。请补充活动名称、完成时间、预期奖励、实际获得情况，以及活动页面或奖励截图。
```

必收字段：

- uid
- activity_name
- completed_at
- expected_reward
- actual_result
- screenshot

### 2.3 游戏 BUG / 结算异常

追问：

```text
这个问题需要结合牌局或设备信息排查。请补充发生时间、玩法名称、牌局 ID、当前版本、设备和系统，以及截图或录屏。
```

必收字段：

- uid
- occurred_at
- game_mode
- table_or_round_id
- app_version
- device
- os
- screenshot_or_video

### 2.4 账号安全

追问：

```text
账号问题需要人工核查。请补充 UID 或绑定手机号后四位、登录方式、设备、异常提示，以及最近一次能正常登录的时间。
```

必收字段：

- uid_or_phone_suffix
- login_method
- device
- error_message
- last_success_login_at

### 2.5 举报投诉

追问：

```text
我可以帮你提交举报反馈。请补充被举报玩家昵称或 UID、牌局 ID、发生时间、举报原因，以及截图或录屏。
```

必收字段：

- reported_user
- table_or_round_id
- occurred_at
- report_reason
- evidence

### 2.6 体验建议

追问：

```text
收到你的建议。为了让策划同学更好判断优先级，请补充建议模块、当前体验问题、期望怎么优化，以及这个问题出现频率。
```

必收字段：

- module
- current_problem
- expected_improvement
- frequency

## 3. 反馈确认卡模板

```json
{
  "type": "feedback_confirm_card",
  "title": "请确认反馈信息",
  "feedback_preview": {
    "category": "",
    "sub_category": "",
    "priority": "",
    "ai_summary": "",
    "collected_fields": {},
    "missing_fields": [],
    "risk_flags": []
  },
  "actions": [
    {
      "label": "确认提交",
      "action": "submit_feedback"
    },
    {
      "label": "继续补充",
      "action": "continue_collecting"
    }
  ]
}
```

## 4. 提交成功文案

```text
已帮你提交反馈，反馈编号：FB202605270001。客服同学会根据你提供的信息继续核查。你之后可以用这个编号查询处理进度。
```

## 5. 进度查询文案

| 状态 | 玩家文案 |
| --- | --- |
| submitted | 你的反馈已提交，正在排队处理。 |
| triaged | 你的反馈已受理，系统已完成问题分类。 |
| processing | 相关同学正在处理中，请耐心等待。 |
| waiting_player | 还需要你补充一些信息后才能继续处理。 |
| resolved | 你的反馈已有处理结论，请查看客服回复。 |
| closed | 该反馈已关闭，如仍有问题可重新提交。 |

## 6. 不完整信息处理

如果玩家不愿继续补充信息，也可以提交低完整度反馈，但需要标记：

```json
{
  "status": "submitted",
  "field_completeness": "low",
  "handling_note": "玩家未补充完整排查信息，需客服二次沟通。"
}
```

