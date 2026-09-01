# 项目约定（供 AI 助手使用）

## 👉 动手前必读

**开始任何开发前，先完整阅读 [`docs/CODEX_PLAYBOOK.md`](docs/CODEX_PLAYBOOK.md)** —— 它定义了本项目的质量标准、分层实现骨架（照抄）、每波「完成的定义」、以及必须避开的坑。本文件只是速览，Playbook 才是权威。

各波开发任务的详细提示词在 [`docs/prompts/`](docs/prompts/)：`W7-content-analytics.md`、`W8-knowledge-rag.md`、`W9-polish.md`。开发某一波时，把对应文件整段作为任务输入。

分波实施计划见 W0–W9 概览（W0–W6 已完成：脚手架/认证/达人/Campaign/AI 基建/发现评分Brief/外联合同）。

## 重要：Next.js 16 有破坏性变更

本项目使用 Next.js 16 —— 部分 API、约定与文件结构和你训练数据里的不同。写代码前先读 `node_modules/next/dist/docs/` 里的相关文档，已知变更：

- `middleware.ts` 已改名为 `proxy.ts`（导出 `proxy` 函数）
- Prisma 7：连接串在 `prisma.config.ts`（非 schema 的 `url`），客户端经 `@prisma/adapter-pg` 连接，生成到 `src/generated/prisma`

## 工程约定

- 全部说明文档、UI 文案、注释用中文；约定式提交（`feat(scope): ...`）
- `src/app` 只做路由装配；业务逻辑在 `src/server/modules`（服务端）与 `src/features`（客户端）
- service 层禁止直接用裸 prisma —— 必须经同模块 repository（注入 tenant_id 过滤）
- 状态变更必须走 `src/shared/constants/status.ts` 的 `assertTransition`，并写 `status_events`
- 对外发送/合同/付款/正式报告 → 必须经 `human_checkpoints` 审批门
- 每次改动收尾跑 `pnpm check`（typecheck + lint + vitest）；每波还要跑相关 `pnpm e2e`
- 详细质量标准、分层骨架、DoD 与踩坑清单见 `docs/CODEX_PLAYBOOK.md`

## 双模型工作流（强制）

本项目采用 **GPT-5.6 Luna 执行 + GPT-5.6 Sol 推理**：

- 默认由 Luna 读取代码、搜索资料、运行命令、修改代码和完成测试验证。
- 遇到复杂架构、跨模块取舍、疑难 Bug 或高风险设计时，Luna 必须先生成 1,000～3,000 Token 的 Task Packet，再交给只读的 `sol_strategist` 深度分析。
- 调用 Sol 时不继承完整会话，只发送真正影响判断的目标、关键代码、核心约束、已尝试方案和待解决问题。
- Sol 只输出结构化方案；Luna 必须回到实际代码验证假设，并负责实现、测试和交付。
- 常规搜索、局部修复、既定方案执行和测试不调用 Sol；同一决策周期默认只升级一次。

完整升级条件、Task Packet 模板和交接规范见 [`docs/CODEX_DUAL_MODEL_WORKFLOW.md`](docs/CODEX_DUAL_MODEL_WORKFLOW.md)。模型配置见 `.codex/config.toml` 和 `.codex/agents/sol-strategist.toml`。
