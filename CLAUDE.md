# 项目约定（供 AI 助手使用）

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
- 每次改动收尾跑 `pnpm check`（typecheck + lint + vitest）
- 计划文件：`/Users/zhishi/.claude/plans/immutable-marinating-dawn.md`（分波实施 W0–W9）
