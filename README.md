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

# 3. 配置基础环境变量
cp .env.example .env
# 模型 Provider / API Key / Base URL 登录后在「Admin → AI 设置」页面填写

# 4. 初始化数据库 + 演示数据
pnpm db:reset && pnpm seed

# 5. 启动（两个进程）
pnpm dev          # Next.js 应用 → http://localhost:3000
pnpm dev:worker   # 后台 Worker（工作流 / RAG / 通知）
```

## 生产安全配置

`docker-compose.yml` 只服务本地开发，数据库与 Redis 端口仅绑定 `127.0.0.1`，不能作为生产编排直接部署。生产环境启动前会强制校验以下配置，缺失或仍使用示例密钥时应用/Worker 会拒绝启动：

- `APP_ORIGIN`：唯一的 HTTPS 应用来源，例如 `https://kol.example.com`。
- `DATA_ENCRYPTION_KEY`、`PAYMENT_FINGERPRINT_KEY`、`AUTH_RATE_LIMIT_HMAC_KEY`：分别生成、至少 32 字节且不得复用。
- `AUTH_CLIENT_IP_HEADER`：由可信反向代理覆盖的单值客户端 IP 头（例如 `x-real-ip`）；应用端口必须禁止绕过该代理直连。
- `REDIS_URL`：生产登录限流采用 Redis，Redis 不可用时登录会安全地拒绝并返回 503。
- `SESSION_ABSOLUTE_TTL_HOURS` / `SESSION_IDLE_TTL_HOURS`：默认分别为 12 小时和 2 小时，绝对期限生产上限为 24 小时。

生产环境不得启用 `ENABLE_DEMO_LOGIN`。浏览器变更请求会校验 `Origin` / Fetch Metadata，因此反向代理必须保留这些标准请求头，并确保外部来源与 `APP_ORIGIN` 完全一致。

部署平台可使用 `GET /api/health/live` 检查 Web 进程存活，使用 `GET /api/health/ready` 检查 PostgreSQL 与 Redis 是否就绪。两个端点无需登录、禁止缓存，且不会返回连接地址或底层错误详情。

## 上线准备

功能分波完成不代表可以直接生产发布。部署拓扑、文件持久化、迁移/恢复、真实 AI、监控值守与 Go / No-Go 证据统一维护在 [`docs/production-launch-plan.md`](docs/production-launch-plan.md)。CI 会执行静态检查、生产构建、数据库集成测试和完整浏览器验收。

## 常用脚本

| 命令                            | 说明                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm check`                    | typecheck + lint + 单元测试（CI 入口）                                                 |
| `pnpm build`                    | 验证 Next.js 生产构建                                                                  |
| `pnpm test:integration`         | 使用隔离 PostgreSQL / Redis 执行迁移与数据库集成测试                                   |
| `pnpm test` / `pnpm test:watch` | Vitest 单元测试                                                                        |
| `pnpm e2e`                      | Playwright 端到端测试（runner 会托管 Next dev + worker，并设置 `MODEL_PROVIDER=fake`） |
| `pnpm db:migrate`               | 开发迁移                                                                               |
| `pnpm db:reset`                 | 重置数据库（危险）                                                                     |
| `pnpm seed`                     | 写入中文演示数据                                                                       |
| `pnpm db:studio`                | Prisma Studio                                                                          |

## 本地验收剧本

推荐用可重复的 fake provider 先跑自动验收：

```bash
docker compose up -d
pnpm install
cp .env.example .env
pnpm db:reset && pnpm seed
pnpm check
pnpm e2e
```

`pnpm e2e` 会自动选择可用端口、启动 Next dev 和 worker、在结束时关闭子进程，并清理当前项目残留的 worker 进程，避免多个 worker 抢同一队列。单独验证最终剧本可运行：

```bash
pnpm e2e e2e/w9-acceptance.spec.ts
```

手工演示时保持两个终端；如果还没有在页面保存模型配置，可临时用 fake provider 回退：

```bash
MODEL_PROVIDER=fake pnpm dev
MODEL_PROVIDER=fake pnpm dev:worker
```

然后使用演示账号登录：

- `admin@demo.com` / `demo1234`：管理员，拥有「星澜传媒」与「北辰品牌部」双组织。
- `viewer@demo.com` / `demo1234`：只读成员，用于验证 Admin 权限拒绝态。

完整 W9 UI 验收路径：

1. 登录后确认 Dashboard 有真实指标，并可切换组织。
2. 新建 Campaign，运行策略生成工作流，前往审批中心批准，确认策略落库。
3. 运行达人发现与评分，批准候选/入围名单，并把达人推进到已批准。
4. 生成 Brief，审批后人工编辑新版本，再按状态机推进到审核中和已批准。
5. 新建外联，会话内 AI 起草，提交审批，批准后标记已发送，记录达人回复并生成谈判分析。
6. 创建合同，提交合同审批；登记付款并提交付款审批。
7. 提交达人内容，发起 AI 内容审核，人工批准后标记发布并录入指标。
8. 生成 Campaign 分析报告，审批后进入报告页导出。
9. 抽查 AI 运行、审计日志、知识问答引用、移动端内容审核/审批页、viewer Admin 权限拒绝、双组织数据隔离。

接真实模型时，用管理员账号进入「Admin → AI 设置」，选择 `OpenAI / 兼容接口`，填写 API Key、Base URL、默认对话模型、轻量模型和向量模型，先点击「测试连接」确认通过，再保存。`.env` 中的模型变量只作为本地/CI 兼容回退；真实业务配置以组织级页面配置为准。

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

## 已知简化 / Deferred

- 当前集成侧重 fake provider 下的可重复验收；真实 OpenAI 输出需按客户品牌语料继续做提示词评估与成本阈值调优。
- 内容发布、指标回传、合同文件与付款账户仍是站内手工录入，暂未接第三方平台、电子签和支付系统。
- RAG 演示数据已覆盖知识问答引用链路，生产级文档解析、权限分层与增量重嵌入可在后续版本细化。
