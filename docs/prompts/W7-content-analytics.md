# 提示词 · W7 — 内容审核 + 数据分析

> 把下面整段贴给 codex。动手前它必须先读 `docs/CODEX_PLAYBOOK.md`（尤其 §3 分层配方、§4 前端拆分、§5 DoD、§6 反面教材）。

---

你在 `/Users/zhishi/project/toufang-2`（Next.js 16 全栈单体）上开发 **W7：内容审核 + 数据分析**。先读 `docs/CODEX_PLAYBOOK.md` 全文，严格遵守其中的十条铁律、分层骨架和「完成的定义」。规格在 `../toufang/docs/superpowers/specs/`（production-database / ai-workflows / ai-agents / page-design），有不合理处可简化，但要在提交信息里说明。

**好消息：核心表和状态机都已存在**，W7 缺的是 prompt / workflow / fixture / 服务 / 路由 / 页面这一层。已存在的：
- 表：`content_assets`、`content_reviews`、`performance_metrics`、`insights`、`reports`（`prisma/schema.prisma`，字段见下）。
- 状态机：`CONTENT_ASSET_STATUS`（9 态，`src/shared/constants/status.ts`）、`CONTENT_SUB_STATUS`（展示用）。
- `insights` 已被 research 工作流写入过（`definitions/research.ts` 里建 `kind:"risk"` 的 insight），照它的写法。

## 关键领域事实

**content_assets**：`campaignCreatorId`、`briefId?`、`title?`、`status`(默认 submitted)、`contentType?`(video|image|article|live)、`platform?`、`caption?`、`transcript?`、`url?`、`plannedPublishAt?`、`publishedAt?`、`publishedUrl?`。
`CONTENT_ASSET_STATUS` 转移：`submitted→[in_review,archived]`、`in_review→[revision_requested,approved,rejected]`、`revision_requested→[submitted,archived]`、`approved→[scheduled,published,in_review]`、`scheduled→[published,approved]`、`published→[archived]`。

**content_reviews**：`contentAssetId`、`status`(queued|reviewing|completed)、`decision?`(approved|needs_revision|rejected)、`riskLevel?`(low|medium|high)、`findings Json`(形如 `[{type,severity,quote,issue,suggestion}]`)、`feedback?`(给达人的修改说明)、`reviewerId?`、以及 AI 溯源块 `aiGenerated/agentRunId/promptKey/promptVersion/model/confidence/completedAt`。

**performance_metrics**（append-only）：`entityType`(campaign|campaign_creator|content_asset)、`entityId`、`platform?`、`metricDate @db.Date`、`metrics Json`(`{impressions,views,likes,comments,shares,clicks,conversions,revenue_cents,cost_cents}`)、`source`(manual|import|integration)。**唯一键** `[tenantId,entityType,entityId,platform,metricDate]` → 用它做 upsert 幂等导入。

**insights**：`campaignId?`、`kind`(anomaly|opportunity|risk|summary)、`title`、`content`、`severity`(info|warning|critical)、`data Json`、`status`(open|acknowledged|dismissed) + 溯源块。
**reports**：`campaignId?`、`title`、`kind`(campaign_retro|executive|custom)、`status`(generating|draft|in_review|approved|exported)、`content Json`、`approvedAt?/approvedBy?` + 溯源块。

## 要交付的东西

### A. 内容审核
1. **（可选但推荐）状态机** `CONTENT_REVIEW_STATUS`：queued→reviewing→completed（若加，就走 `assertTransition` + `status_events`）。
2. **Prompt** `src/server/ai/prompts/content-review.ts`，key `content_review.evaluate`：输入内容资产 + Brief 版本 + 品牌 guidelines/restricted_terms + 平台规则；输出 `{decision, risk_level, findings:[{type,severity,quote,issue,suggestion}], creator_feedback}`。系统提示要求：**只依据 Brief 与规则判断，不臆造要求；修改建议具体、可执行、友好；任何 high 风险发现强制人工复核。**
3. **Fake fixture**：`content_review.evaluate` 的确定性输出（满足 schema）。
4. **工作流** `definitions/content-review.ts`：gather（内容 + brief + 品牌规则）→ evaluate（`runAgent`，**挂 `checkpoint` type `content`、assigneeRole `content_manager`**）→ apply（写 `content_reviews`，带溯源；据 decision 推 `content_assets` 状态）。注册进 `definitions/index.ts`。
5. **审批联动**：`checkpoint.service.ts` 加 `type === "content"` 分支，动态 import 你的 `onContentReviewDecided`（approve→内容转 approved/scheduled；reject/changes→revision_requested，生成给达人的修改说明）。
6. **模块 + 路由**：`server/modules/content/`（repository+service）；路由 `api/v1/content-assets`（列表/详情/建/推状态）、`api/v1/content-assets/[id]/reviews`（触发审核/看结果）。
7. **内容审核工作台** `app/(app)/content-review/page.tsx` + `features/content-review/`：左=审核队列，中=内容预览（caption/transcript/链接），右=AI findings 面板 + 审批操作（通过/拒绝/要求修改）。四态齐全（含 **Brief 缺失** 的错误态）。findings 高亮、high 风险二次确认。

### B. 数据分析
8. **Analytics Agent** `prompts/analytics.ts`（key `analytics.analyze`）：输入指标 + 预算 + KPI + `date_range`；输出 `{summary, kpi_status, top_performers, low_performers, anomalies:[], recommendations:[], data_quality_notes}`。提示要求：**缺数据必须明说不得编造；事实与推断分离；每条建议是可执行的下一步动作。**
9. **Report Agent** `prompts/report.ts`（key `report.generate`）：输入 insights + 指标 + 排名 + 目标；输出 `{title, executive_summary, narrative, key_learnings:[], recommendations:[], data_limitations:[], requires_approval:true}`。**产出必须等人工复核才能导出。**
10. **Fake fixtures**：两个 key 的确定性输出。
11. **（可选）状态机** `REPORT_STATUS`（generating→draft→in_review→approved→exported）。
12. **指标模块**：`server/modules/analytics/`；路由 `api/v1/metrics`（按唯一键 upsert 导入 + 查询聚合）、`api/v1/insights`（生成/列表/改状态）、`api/v1/reports`（生成/编辑/提交审批/导出）。
13. **工作流** `definitions/analytics.ts`：采集 → 归一 → 计算 → analyze（生成 insights）→ report 草稿（**挂 checkpoint type `report`、assigneeRole `manager`**）→ 落 `reports`。注册。审批联动同上加 `type === "report"` 分支。
14. **分析总览页** `app/(app)/analytics/` + `features/analytics/`：日期范围、KPI 卡、图表（用 **Apache ECharts**）、达人/内容排名、AI Insights、数据质量提示。四态齐全。
15. **报告页** `app/(app)/reports/`（或分析页内）：报告编辑、AI 段落、引用面板、提交审批、导出、审批面板。
16. **Dashboard 补全**：把真实指标/insights 接进 `/dashboard`。

### C. 收尾
17. `nav-config.ts`：解锁 `/content-review`、`/analytics`、`/reports`，加进 `IMPLEMENTED_ROUTES`。
18. **Seed** `prisma/seed-content-analytics.ts`：给"进行中"的焕亮 Campaign 造几条已提交内容（含一条 high 风险待审）、几十天 `performance_metrics`、几条 insights、一份 draft 报告。幂等，**注意 UUIDv7 唯一键陷阱**（取 `id.slice(-12)`）。挂进 `seed.ts`。
19. **vitest**：内容审核状态流转 + 审批门、metrics upsert 幂等、analytics 缺数据不编造。
20. **e2e** `e2e/w7-content-analytics.spec.ts`：登录 → 内容审核工作台 → 触发 AI 审核（fake）→ findings 可见 → 审批中心通过 → 内容转已通过；再 → 分析页看到 KPI/图表/insights。参照 `e2e/w5`、`e2e/w6`。

## 完成标准
对照 `docs/CODEX_PLAYBOOK.md` §5 DoD 和 §7 自检逐条过。特别注意 §6 四个坑：**page.tsx 不超 200 行、组件拆进 features/components、seed 无 UUID 唯一键坑、有 e2e、无死代码**。`pnpm check` + `pnpm seed` + 相关 `pnpm e2e` 全绿后，一个约定式提交 `feat(content-analytics): W7 内容审核 + 数据分析`。
