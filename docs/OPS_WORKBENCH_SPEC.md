# 产品运营端反馈工作台交互规格

更新时间：2026-05-28  
状态：设计文档，暂不进入界面重构  
目标：定义客服、运营、策划、技术/测试用于处理玩家反馈的内部工作台。

## 1. 页面定位

运营端不是聊天页，而是反馈分拣与处理工作台。它的目标是：

- 快速识别高优问题。
- 查看 AI 结构化摘要。
- 补齐缺失字段。
- 流转处理状态。
- 为飞书同步、P0/P1 告警和日报提供入口。

## 2. 推荐布局

运营端建议采用桌面优先的三栏或两栏布局。

```text
顶部工具栏
  - 项目名称
  - 搜索框
  - 日期范围
  - 同步/导出/日报入口

左侧筛选栏
  - 优先级
  - 状态
  - 分类
  - 负责人
  - 情绪/风险

中间反馈列表
  - 反馈 ID
  - 优先级
  - 分类
  - 摘要
  - 状态
  - 创建时间

右侧详情面板
  - 玩家原始问题
  - AI 摘要
  - 结构化字段
  - 缺失字段
  - 风险标签
  - 状态流转
  - 处理记录
```

## 3. 反馈列表字段

| 字段 | 说明 |
| --- | --- |
| feedback_id | 反馈编号 |
| priority | P0/P1/P2/P3 |
| category | 一级分类 |
| sub_category | 二级分类 |
| ai_summary | AI 摘要 |
| status | 当前状态 |
| owner | 当前负责人 |
| created_at | 创建时间 |
| field_completeness | 字段完整度 |
| sync_status | 飞书同步状态，后续可隐藏或放到更多信息 |

列表排序建议：

1. P0。
2. P1。
3. `waiting_player` 或长时间未处理。
4. 最新提交。

## 4. 筛选与搜索

MVP 筛选：

- 优先级：全部、P0、P1、P2、P3。
- 状态：全部、已提交、已受理、处理中、待补充、已处理、已关闭。
- 分类：支付充值、活动奖励、游戏 BUG、账号安全、举报投诉、体验建议、玩法规则。
- 负责人：全部、支付/客服、活动运营/客服、客户端/测试、风控/客服、策划/运营。

搜索：

- 反馈 ID。
- 玩家 UID。
- 原始问题关键词。
- AI 摘要关键词。

## 5. 详情面板

详情面板展示：

| 区块 | 内容 |
| --- | --- |
| 概览 | ID、优先级、状态、负责人、创建时间 |
| 玩家问题 | raw_question、UID、设备、版本、渠道 |
| AI 结构化 | category、sub_category、ai_summary、entities、emotion、risk_flags |
| 字段完整度 | required_fields、missing_fields、field_completeness |
| 处理状态 | timeline、handling_note、resolution |
| 协同状态 | feishu sync、notification status、duplicate group，后续可折叠 |

## 6. 状态流转

状态流转仍沿用当前规则：

```text
submitted -> triaged / waiting_player
triaged -> processing / waiting_player
processing -> resolved / waiting_player
waiting_player -> processing / closed
resolved -> closed
```

运营端按钮文案：

| 当前状态 | 可操作按钮 |
| --- | --- |
| submitted | 标记已受理、要求玩家补充 |
| triaged | 开始处理、要求玩家补充 |
| processing | 标记已处理、要求玩家补充 |
| waiting_player | 玩家已补充、关闭 |
| resolved | 关闭 |
| closed | 无 |

## 7. 处理记录

MVP 可先使用简单文本：

```text
处理记录：
支付链路排查中，等待订单侧确认。
```

后续可升级为多条日志：

| 字段 | 说明 |
| --- | --- |
| operator | 操作人 |
| action | 操作 |
| note | 备注 |
| created_at | 时间 |

## 8. 高优问题展示

P0/P1 应在列表中明显突出，但避免视觉过度喧闹。

建议：

- P0：红色标签 + 列表置顶。
- P1：黄色标签 + 列表靠前。
- P2/P3：常规标签。

P0/P1 详情页增加：

- 风险标签。
- 建议负责人。
- 同类反馈数量。
- 告警状态，后续接飞书。

## 9. 与玩家端的关系

| 玩家端动作 | 运营端结果 |
| --- | --- |
| 提交反馈 | 运营端新增工单 |
| 玩家补充信息 | 工单 missing_fields 减少 |
| 玩家查进度 | 读取运营端当前 status |
| 工单 resolved | 玩家端展示“已有处理结论” |
| 工单 waiting_player | 玩家端提示补充信息 |

## 10. 与当前 debug 页的关系

当前 `app/index.html` 暂定为 debug 页，保留完整信息：

- 聊天。
- 意图识别。
- 工单列表。
- 状态流转。
- 飞书 mock。

后续运营端只复用其中的：

- 工单列表。
- 工单详情。
- 状态流转。
- 同步状态。

不复用：

- 玩家聊天欢迎语。
- 快捷问题入口。
- 面向玩家的话术。

## 11. 运营端验收标准

| 验收点 | 标准 |
| --- | --- |
| 工单可见 | 玩家提交后，运营端列表出现新反馈 |
| 高优突出 | P0/P1 能快速识别 |
| 筛选可用 | 可按优先级、状态、分类筛选 |
| 详情完整 | 能看到原始问题、AI 摘要、字段、缺失项 |
| 状态流转 | 能按合法路径流转状态 |
| 处理闭环 | resolved/closed 后玩家端能查到进度变化 |

