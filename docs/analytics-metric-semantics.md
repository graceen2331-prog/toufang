# 分析指标语义约定

## 总览原则

- `PerformanceMetric` 是“实体 + 平台 + 日期”的最新日粒度快照，不是事件流水。
- JSON 中缺少指标 key 表示“未提供”；数值 `0` 表示“明确观测为 0”，两者不得互换。
- 总览先按 Campaign 和日期分组，再在 `campaign → campaign_creator → content_asset` 中选择字段完整的最高聚合层；选中后忽略其他层，避免重复计算。
- 同一指标族不得混合聚合层或来源。全局视图先逐 Campaign 消重，再跨 Campaign 汇总。
- Campaign 视图只展示该 Campaign 的洞察；全局视图只展示 `campaign_id IS NULL` 的租户级洞察。

## KPI 定义

| 指标 | 公式 | 完整字段 |
|---|---|---|
| 互动率 | `(点赞 + 评论 + 分享) / 曝光` | `impressions`、`likes`、`comments`、`shares` |
| 点击率 | `点击 / 曝光` | `impressions`、`clicks` |
| 转化率 | `转化 / 点击` | `clicks`、`conversions` |
| CPA | `已记录成本 / 转化` | `cost_cents`、`conversions` |
| ROAS | `收入 / 已记录成本` | `revenue_cents`、`cost_cents`，以及一致的币种、归因窗口和归因模型 |

`revenue / cost` 不是 ROI。当前系统没有利润或毛利口径，因此 API 的兼容字段 `roi` 固定返回 `null`。任何分母为 0 的比率返回 `null`，不会显示无穷大或伪造为 0。

## 财务与新鲜度

- 财务指标必须写入 ISO 4217 三位币种、归因窗口天数和归因模型。
- 历史记录缺少币种时，可由其唯一关联的 Campaign 币种推断，但必须返回 `CURRENCY_INFERRED` 提示；归因口径不得推断。
- 多币种、混合来源或混合归因时不生成合并 ROAS，也不接入隐式汇率换算。
- 新鲜度优先展示 `source_observed_at`；缺失时只能称为“最近入库”，使用 `ingested_at`。

## 排名

排名按实体类型和平台分别计算，不跨平台比较。当前使用互动率，最低样本为 100 曝光；必要字段不完整、来源混合或样本不足的实体不进入排名。高表现与需关注列表使用同一口径且不重叠。

## 暂不支持

本阶段不做真正 ROI、汇率换算、多触点归因、复杂统计排名、指标事件历史和外部平台连接器。
