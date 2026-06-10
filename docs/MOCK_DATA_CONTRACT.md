# MVP Mock 数据契约

更新时间：2026-05-27  
用途：定义前端、本地检索和反馈 mock API 使用的数据结构。

## 1. 知识库数据

来源：

```text
data/knowledge_base/card_game_kb_seed.json
```

核心字段：

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| knowledge_id | string | 知识唯一 ID |
| project | string | 项目 |
| module | string | 玩法规则/活动规则/比赛规则 |
| topic | string | 标题 |
| source | string | 截图来源 |
| source_status | string | 完整/部分缺失/待确认 |
| common_questions | string[] | 检索召回 |
| answer | string | 标准回答 |
| clarification_strategy | string | 追问策略 |
| no_answer_boundary | string | 不可回答边界 |
| tags | string[] | 关键词召回 |
| updated_at | string | 更新时间 |

## 2. 玩家消息

```json
{
  "message_id": "MSG202605270001",
  "role": "user",
  "content": "黄金牌活动炸弹怎么算？",
  "created_at": "2026-05-27 20:30:00"
}
```

## 3. Agent 消息

```json
{
  "message_id": "MSG202605270002",
  "role": "agent",
  "content": "黄金牌活动中，炸弹最大，可以压制其他牌型...",
  "message_type": "text",
  "references": [
    {
      "knowledge_id": "KB-CARD-20260527-0004",
      "topic": "黄金牌活动牌型、黄金牌与破封"
    }
  ],
  "created_at": "2026-05-27 20:30:03"
}
```

## 4. 意图识别结果

```json
{
  "intent": "knowledge_query",
  "category": "玩法规则",
  "sub_category": "黄金牌活动",
  "entities": {
    "game_mode": "黄金牌活动",
    "card_type": "炸弹"
  },
  "emotion": "中性",
  "risk_flags": [],
  "priority_hint": "P3",
  "next_action": "answer_from_kb",
  "confidence": 0.86
}
```

## 5. 反馈草稿

```json
{
  "feedback_id": "",
  "project": "示例棋牌项目",
  "source": "game_webview",
  "status": "draft",
  "category": "活动奖励",
  "sub_category": "奖励未到账",
  "raw_question": "连续挑战活动第9轮奖励没发",
  "ai_summary": "玩家反馈连续挑战活动第9轮完成后未收到奖励，需要核查活动发奖记录。",
  "priority": "P1",
  "required_fields": ["uid", "activity_name", "completed_at", "expected_reward", "screenshot"],
  "collected_fields": {
    "activity_name": "连续挑战活动",
    "expected_reward": "第9轮稀有称号"
  },
  "missing_fields": ["uid", "completed_at", "screenshot"],
  "risk_flags": ["manual_review"]
}
```

## 6. 已提交反馈

```json
{
  "feedback_id": "FB202605270001",
  "project": "示例棋牌项目",
  "source": "game_webview",
  "created_at": "2026-05-27 20:35:00",
  "updated_at": "2026-05-27 20:35:00",
  "status": "submitted",
  "owner": "活动运营/客服",
  "player": {
    "uid": "123456789",
    "channel": "",
    "login_version": "",
    "device": "",
    "os": ""
  },
  "issue": {
    "raw_question": "连续挑战活动第9轮奖励没发",
    "category": "活动奖励",
    "sub_category": "奖励未到账",
    "ai_summary": "玩家反馈连续挑战活动第9轮完成后未收到奖励，需要核查活动发奖记录。",
    "intent": "提交反馈",
    "entities": {
      "activity_name": "连续挑战活动",
      "expected_reward": "第9轮稀有称号"
    },
    "emotion": "轻微负面",
    "risk_flags": ["manual_review"],
    "priority": "P1",
    "confidence": 0.82
  },
  "collaboration": {
    "feishu_doc_synced": false,
    "feishu_group_notified": false,
    "notification_level": "owner",
    "duplicate_group_id": "",
    "related_feedback_count": 1,
    "handling_note": "",
    "resolution": "",
    "closed_at": ""
  }
}
```

## 7. 工单增强字段

在已提交反馈上新增以下字段，用于状态流转、进度查询和后续协同系统同步：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| field_completeness | string | 字段完整度：high / medium / low |
| required_fields | string[] | 当前场景必填字段 |
| missing_fields | string[] | 尚缺字段 |
| timeline | object[] | 状态流转记录 |
| closed_at | string | 工单关闭时间 |

状态流转记录：

```json
{
  "status": "triaged",
  "at": "2026-05-28 10:05:00",
  "note": "系统已完成分类和优先级判断。"
}
```

## 8. 飞书同步 mock 字段

飞书同步状态记录在 `collaboration` 下：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| sync_status | string | pending / success / failed / retrying |
| sync_retry_count | number | 同步失败重试次数 |
| sync_error_message | string | 最近一次同步失败原因 |
| last_sync_at | string | 最近同步时间 |
| feishu_record_id | string | 飞书多维表格记录 ID |
| feishu_table | string | 同步目标表 |

mock 成功示例：

```json
{
  "feishu_doc_synced": true,
  "sync_status": "success",
  "sync_retry_count": 0,
  "sync_error_message": "",
  "last_sync_at": "2026-05-28 14:01:00",
  "feishu_record_id": "mock_bitable_FB202605280001",
  "feishu_table": "玩家反馈表"
}
```
