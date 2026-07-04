# KOL Marketing OS（toufang-2）

AI 原生 KOL 营销操作系统 —— 覆盖市场研究、达人发现、Campaign 策划、达人触达、Brief 生成、内容审核、效果分析、复盘报告与组织知识沉淀的完整业务闭环。

> 规格文档（单一事实源）：`/Users/zhishi/project/toufang/docs/superpowers/specs/`

## 技术栈

- **Next.js 16**（App Router，全栈单体）+ React 19 + TypeScript strict
- **PostgreSQL 17 + pgvector**（Prisma 7）、**Redis 7**（BullMQ 队列）
- **Tailwind CSS v4 + shadcn/ui**、TanStack Query/Table、React Hook Form + Zod、Apache ECharts
- **AI**：ModelRouter 抽象（OpenAI 默认 / fake 测试 / Anthropic·Gemini 预留），DB 状态机工作流引擎 + 人工审批门，pgvector RAG

## 快速开始

```bash
# 1. 启动基础设施（PostgreSQL + Redis）
docker compose up -d

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env   # 按需填入 OPENAI_API_KEY

# 4. 初始化数据库 + 演示数据
pnpm db:migrate
pnpm seed

# 5. 启动（两个进程）
pnpm dev          # Next.js 应用 → http://localhost:3000
pnpm dev:worker   # 后台 Worker（工作流 / RAG / 通知）
```

## 常用脚本

| 命令 | 说明 |
|---|---|
| `pnpm check` | typecheck + lint + 单元测试（CI 入口） |
| `pnpm test` / `pnpm test:watch` | Vitest 单元测试 |
| `pnpm e2e` | Playwright 端到端测试（`MODEL_PROVIDER=fake`） |
| `pnpm db:migrate` | 开发迁移 |
| `pnpm db:reset` | 重置数据库（危险） |
| `pnpm seed` | 写入中文演示数据 |
| `pnpm db:studio` | Prisma Studio |

## 目录结构

```
src/
├── app/          # 路由与页面装配（不写业务逻辑）
│   └── api/v1/   # REST API（统一信封 / 错误码 / 游标分页 / 幂等键）
├── worker/       # BullMQ Worker 进程入口
├── server/       # 服务端业务代码（server-only）
│   ├── api/      # createApiHandler、信封、错误映射
│   ├── auth/     # Cookie Session、RBAC、租户上下文
│   ├── db/       # Prisma 客户端（业务代码经 repository 访问）
│   ├── modules/  # 领域模块（service + repository）
│   ├── ai/       # ModelRouter / Prompt 注册表 / Agents / 成本记账
│   ├── workflows/# 工作流引擎 + 各工作流定义
│   ├── rag/      # 解析 / 分块 / 嵌入 / 检索
│   └── jobs/     # BullMQ 队列定义
├── shared/       # 前后端共用：Zod schema、状态机、权限、错误码
├── components/   # ui(shadcn) / shared(通用业务组件) / layout(壳)
├── features/     # 客户端功能模块（api + queries + components）
└── lib/          # apiFetch、queryClient、工具
```

## 核心工程约定

- **租户隔离**：所有业务表带 `tenant_id`，repository 层强制注入过滤，禁止 service 直接访问裸 prisma（ESLint 强制）。
- **状态机**：所有实体状态、转移规则、中文标签定义在 `src/shared/constants/status.ts`，服务端 `assertTransition` 校验，前端 StatusTag 渲染。
- **人工审批门**：对外发送、合同、付款、正式报告等高风险操作必须经 `human_checkpoints` 审批。
- **AI 可追溯**：每次模型调用记录 `ai_usage_events`（token/成本）；AI 产物记录 `agent_run_id + prompt_key + prompt_version + model`。
- **软删除**：业务表 `deleted_at`；审计/工作流/用量等 append-only 表永不删除。
