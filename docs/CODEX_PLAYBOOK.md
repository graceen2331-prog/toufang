# CODEX PLAYBOOK — 在 toufang-2 上达到高质量交付

> 这份文档写给接手 W7–W9 的 AI 助手（codex）。目标只有一个：**让你写出的代码和已完成的 W0–W6 一个水准，可以直接合并，不需要返工。**
>
> 读完本文你要能回答：代码放哪、每一层长什么样、怎么算"做完了"、哪些坑绝对不能踩。配套的每波提示词在 `docs/prompts/`。

---

## 0. 心法：这个项目的最高优先级是「可维护性」

这是一次**重写**。上一版（`../toufang`）功能齐全但工程性差——775 行的 god 组件、prop-drilling、2851 行的路由分发器、JSON 文件当数据库。重写的全部意义就是**不要再犯那些错**。

所以判断你的代码好不好，标准不是"能跑"，而是：

1. **单一职责** —— 每个文件只做一件事，`page.tsx` 只装配、`service` 只编排、`repository` 只碰数据库。
2. **可复用** —— 重复出现的 UI/逻辑必须抽成组件/函数，不允许 copy-paste。
3. **可测** —— 状态机、计价、租户隔离这类核心逻辑有 vitest；每个用户可见的流程有一条 Playwright e2e。
4. **一眼能读懂** —— 命名、注释、结构和周围代码一致；注释和文案用中文。

> ⚠️ **绿色的 `pnpm check` 不等于做完了。** W6 第一版 typecheck/lint/test 全绿，但把 800 行塞进一个 `page.tsx`、seed 有唯一键冲突 bug、没有 e2e。"绿"是底线，不是目标。交付前请对照 §5 的 DoD 和 §7 的自检流程。

---

## 1. 五分钟架构地图

```
toufang-2/
├── prisma/
│   ├── schema.prisma          # 46 表，改表要 pnpm db:migrate
│   ├── seed.ts                # 入口，按域拆成 seed-*.ts
│   └── seed-*.ts              # 各域演示数据（中文）
├── src/
│   ├── app/                   # ★ 只做路由装配，禁止业务逻辑
│   │   ├── (app)/<page>/page.tsx      # 页面 = 组装 features 里的组件
│   │   └── api/v1/**/route.ts         # 路由 = 绑定 createApiHandler
│   ├── server/                # import "server-only"，客户端禁止 import
│   │   ├── api/               # createApiHandler、信封、错误码、分页
│   │   ├── db/client.ts       # prisma 实例（只有 repository 能 import）
│   │   ├── modules/<domain>/  # <domain>.repository.ts + <domain>.service.ts
│   │   ├── ai/
│   │   │   ├── prompts/<agent>.ts     # Prompt 定义（含 Zod outputSchema）
│   │   │   ├── router/                # ModelRouter：openai / fake provider
│   │   │   └── agents/run-agent.ts    # 通用 Agent 执行器
│   │   └── workflows/
│   │       ├── engine.ts              # DB 状态机工作流引擎
│   │       └── definitions/<wf>.ts    # 各工作流定义 + index.ts 注册
│   ├── shared/                # ★ 前后端共用
│   │   ├── constants/status.ts        # 所有状态机（唯一真相源）
│   │   ├── constants/permissions.ts   # 权限 + 角色矩阵
│   │   └── schemas/<domain>.ts         # Zod 校验 + DTO 类型 + 中文 label 映射
│   ├── features/<domain>/     # ★ 客户端业务
│   │   ├── queries.ts                  # TanStack Query key factory + hooks
│   │   └── components/*.tsx            # 该域的所有 UI 组件
│   ├── components/
│   │   ├── ui/                # shadcn 基础组件（别手改）
│   │   ├── shared/           # 跨域复用：DataTable、AsyncBoundary、StatusTag…
│   │   └── layout/          # AppShell、nav-config.ts
│   └── lib/                   # apiFetch、format、list-state、utils
└── e2e/                       # 每波一个 w<N>-*.spec.ts
```

**数据流（一个读请求）**：
`page.tsx` → `features/queries.ts (useQuery)` → `lib/api apiFetch` → `app/api/v1/.../route.ts (createApiHandler)` → `server/modules/<d>.service.ts` → `server/modules/<d>.repository.ts` → prisma → PostgreSQL

**一个 AI 请求**：
UI 触发 → route → service `runAgent()` / 或工作流 `startWorkflow()` → 入队 BullMQ → worker 跑 step → `routerChat`（fake/openai）→ 结构化输出落库 → SSE 推进度。

---

## 2. 十条不可违背的铁律

1. **`src/app` 只装配。** `page.tsx` 里不写业务组件定义，不写 `fetch`。组件放 `features/<domain>/components/`，数据放 `features/<domain>/queries.ts`。`route.ts` 里不写业务，只调 service。
2. **service 不碰裸 prisma。** 一切 DB 访问经同域 `repository`，repository 每个查询都带 `tenantId: ctx.orgId` 和 `deletedAt: null`。违反会被 ESLint 拦。
3. **状态变更走状态机。** 改任何实体 status 前调 `assertTransition(MACHINE, from, to)`，并在同一事务里 `recordStatusEvent`。新状态机加在 `shared/constants/status.ts`。
4. **对外/资金/正式产物必须过审批门。** 外发消息、合同、付款、正式报告、发布——都要建 `human_checkpoints`，等人工 `decideCheckpoint` 后才继续。**这是产品的核心安全属性，不能省。**
5. **敏感字段应用层加密。** 达人联系方式、付款账户等走 AES（见 `server/` 里现有加密工具），不落明文。
6. **AI 产物带溯源。** 任何 AI 写入的行都要填 `agentRunId / promptKey / promptVersion / model`（表里已有这些列）。
7. **snake_case 出入参，camelCase 内部。** API 信封/DTO 用 snake_case（`campaign_creator_id`），Prisma/TS 内部 camelCase。转换在 service 的 `toDto` 里做。
8. **每层可复用。** 出现第二次的 UI/逻辑立刻抽出去（组件进 `features/components` 或 `components/shared`，函数进 `lib/`）。
9. **每波交付 = 代码 + vitest + e2e + seed 演示数据。** 少一样都不算完。
10. **中文文案、中文注释、约定式提交。** `feat(scope): ...`，结尾 `Co-Authored-By` 见 §9。

---

## 3. 分层实现配方（照抄骨架）

下面每个骨架都取自仓库里**真实存在**的代码，直接仿写即可。占位符用 `Xxx`。

### 3.1 状态机（`src/shared/constants/status.ts`）

新增一个实体状态机时，追加一个 `StateMachine`：

```ts
export const XXX_STATUS: StateMachine = {
  entityType: "xxx",
  field: "status",
  initial: "draft",
  states: {
    draft:     { label: "草稿",   tone: "neutral" },
    in_review: { label: "审核中", tone: "warning" },
    approved:  { label: "已通过", tone: "success" },
    // …每个状态都要有中文 label 和 tone
  },
  transitions: {
    draft:     ["in_review"],
    in_review: ["approved", "draft"],
    approved:  [],
  },
};
```

- `tone` 决定 `StatusTag` 的颜色，取值见文件顶部 `StatusMeta`。
- 纯展示的子状态（不需要转移校验）用 `Record<string, StatusMeta>`，不要写 `transitions`。
- 校验用 `assertTransition(XXX_STATUS, from, to)`，非法转移抛 `InvalidTransitionError`。

### 3.2 Repository（`src/server/modules/<domain>/<domain>.repository.ts`）

**唯一能 import `@/server/db/client` 的地方。** 每个方法强制注入租户过滤。范式（照抄 `contract.repository.ts`）：

```ts
import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma, Xxx } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { recordStatusEvent } from "@/server/modules/status-events/status-event.repository";

export interface XxxListParams {
  limit: number; cursor: string | null; order: "asc" | "desc";
  status: string | null;   // 其余筛选字段
}

const xxxInclude = { /* 关联 */ } satisfies Prisma.XxxInclude;
export type XxxWithRelations = Prisma.XxxGetPayload<{ include: typeof xxxInclude }>;

export const xxxRepository = {
  // 游标分页：take limit+1，orderBy id，cursor 用 id 的 lt/gt
  async list(ctx: TenantCtx, p: XxxListParams): Promise<XxxWithRelations[]> {
    return prisma.xxx.findMany({
      where: {
        tenantId: ctx.orgId, deletedAt: null,
        ...(p.status ? { status: p.status } : {}),
        ...(p.cursor ? { id: p.order === "desc" ? { lt: p.cursor } : { gt: p.cursor } } : {}),
      },
      include: xxxInclude,
      orderBy: { id: p.order },
      take: p.limit + 1,
    });
  },

  async find(ctx: TenantCtx, id: string) {
    return prisma.xxx.findFirst({ where: { id, tenantId: ctx.orgId, deletedAt: null }, include: xxxInclude });
  },

  async create(ctx: TenantCtx, data: Omit<Prisma.XxxUncheckedCreateInput, "tenantId">) {
    return prisma.xxx.create({ data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null } });
  },

  // 状态转移永远走事务 + recordStatusEvent
  async transition(ctx: TenantCtx, id: string, from: string, to: string, reason: string | null,
                   extra: Prisma.XxxUncheckedUpdateInput = {}): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.xxx.updateMany({
        where: { id, tenantId: ctx.orgId, deletedAt: null },
        data: { status: to, updatedBy: ctx.userId ?? null, ...extra },
      });
      await recordStatusEvent(
        { tenantId: ctx.orgId, entityType: "xxx", entityId: id, fromValue: from, toValue: to,
          actorId: ctx.userId ?? null, reason }, tx);
    });
  },
};
```

> 关联表跨租户时用「先查主表 → 再按 id 批量 hydrate」的写法（见 `contract.repository.ts` 的 `hydrateContracts`），不要用 Prisma 深层 include 绕过租户过滤。

### 3.3 Service（`src/server/modules/<domain>/<domain>.service.ts`）

编排 + 校验 + 状态机 + DTO 转换。**不碰 prisma**，只调 repository。范式（照抄 `contract.service.ts`）：

```ts
import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import { XXX_STATUS, assertTransition } from "@/shared/constants/status";
import type { XxxDto } from "@/shared/schemas/xxx";
import { xxxRepository, type XxxListParams, type XxxWithRelations } from "./xxx.repository";

function toDto(x: XxxWithRelations): XxxDto {
  return { id: x.id, status: x.status, /* …snake_case，日期 .toISOString() */ };
}

export async function listXxx(ctx: TenantCtx, params: XxxListParams):
  Promise<{ items: XxxDto[]; pagination: Pagination }> {
  const rows = await xxxRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);   // 处理 limit+1 → has_more
  return { items: items.map(toDto), pagination };
}

export async function transitionXxx(ctx: TenantCtx, id: string, to: string, reason?: string | null) {
  const x = await xxxRepository.find(ctx, id);
  if (!x) throw new ApiError("RESOURCE_NOT_FOUND", "不存在");
  assertTransition(XXX_STATUS, x.status, to);
  // 需要审批门的转移：拒绝直接跨门，改为建 checkpoint
  if (x.status === "in_review" && to === "approved") {
    throw new ApiError("CONFLICT", "请在审批中心批准，不能绕过审批门");
  }
  await xxxRepository.transition(ctx, id, x.status, to, reason ?? null);
  // …联动其它实体状态
}
```

错误一律 `throw new ApiError(code, message)`，`code` 用 `envelope.ts` 里已定义的命名空间错误码。

### 3.4 Shared schema（`src/shared/schemas/<domain>.ts`）

前后端共用的 Zod 校验 + DTO 类型 + 中文 label 映射：

```ts
import { z } from "zod";

export const XxxCreateSchema = z.object({
  campaign_creator_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
  notes: z.string().nullish(),
});                                   // ← route 的 body 校验直接用它

export interface XxxDto {             // ← service.toDto 的返回类型、features 里 useQuery 的泛型
  id: string; status: string; amount_cents: number; created_at: string;
}

export const XXX_STATUS_LABELS: Record<string, string> = { /* 若需页面独立映射 */ };
```

> RHF + zodResolver 有坑：**别在 schema 字段上用 `.default()`**（会破坏 resolver 泛型），数字输入用 `valueAsNumber` 在 register 时转。

### 3.5 Route（`src/app/api/v1/<resource>/route.ts`）

只绑定，不写业务。范式（照抄 `contracts/route.ts`）：

```ts
import { createApiHandler, paginated } from "@/server/api/handler";
import { parseListQuery } from "@/server/api/pagination";
import { createXxx, listXxx } from "@/server/modules/xxx/xxx.service";
import { XxxCreateSchema } from "@/shared/schemas/xxx";

export const GET = createApiHandler({
  permission: "xxx:read",
  handler: async (ctx) => {
    const query = parseListQuery(ctx.searchParams);       // {limit,cursor,order}
    const { items, pagination } = await listXxx(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      { ...query, status: ctx.searchParams.get("status") },
    );
    return paginated(items, pagination);                  // 自动套信封
  },
});

export const POST = createApiHandler({
  permission: "xxx:write",
  body: XxxCreateSchema,          // Zod 自动校验 → ctx.body 已是类型安全
  audit: "xxx.create",            // 自动写 audit_logs
  created: true,                  // 201
  handler: async (ctx) => {
    const x = await createXxx({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.body);
    ctx.setAuditEntity("xxx", x.id);
    return x;
  },
});
```

`createApiHandler` 已经处理：requestId → 鉴权 → RBAC(`permission`) → Zod(`body`) → 调 handler → 审计 → 信封序列化 → 错误码映射。你只写 `handler`。

### 3.6 AI 四层（新增一个 Agent 时全部要写）

**① Prompt**（`src/server/ai/prompts/<agent>.ts`）——照抄 `outreach.ts` / `brief.ts`：

```ts
import { z } from "zod";
import type { PromptDefinition } from "./strategy";   // {key,version,system,outputSchema}

export const XxxOutputSchema = z.object({
  decision: z.enum(["approved", "needs_revision", "rejected"]),
  findings: z.array(z.object({ type: z.string(), severity: z.string(), issue: z.string() })),
});
export type XxxOutput = z.infer<typeof XxxOutputSchema>;

export const xxxPrompt: PromptDefinition<typeof XxxOutputSchema> = {
  key: "xxx.evaluate",          // 溯源用，稳定不变
  version: "v1",                // ★ 改 system/schema 就 +1
  system: `你是……。只依据 Brief 与规则判断，不得臆造要求。
严格输出如下 JSON：{ "decision": "...", "findings": [...] }`,
  outputSchema: XxxOutputSchema,
};
```

**② Fake fixture**（`src/server/ai/router/fake.ts`）——加一个 key，值必须**满足 outputSchema**，CI/演示靠它确定性输出：

```ts
const FIXTURES = {
  // …已有的
  "xxx.evaluate": { decision: "needs_revision", findings: [{ type: "brand", severity: "medium", issue: "…" }] },
};
```

**③ 执行**：service/workflow 里调通用 `runAgent`（别自己拼 provider）：

```ts
const { output, agentRunId } = await runAgent({
  tenantId: ctx.orgId, agentKey: "xxx",
  workflowRunId: ctx.runId,          // 工作流内才传
  prompt: xxxPrompt,
  userMessage: JSON.stringify(context),
  createdBy: ctx.userId ?? null,
});
// output 已按 outputSchema 校验；把 agentRunId 连同 promptKey/version/model 写进落库行做溯源
```

**④ 工作流定义**（`src/server/workflows/definitions/<wf>.ts`）——照抄 `research.ts`/`brief.ts`，三段式 gather → generate(挂 checkpoint) → apply：

```ts
export const xxxWorkflow: WorkflowDefinition = {
  key: "xxx", label: "内容审核",
  steps: [
    { key: "gather", label: "汇集上下文", run: async (ctx) => ({ context: await gather(ctx) }) },
    { key: "generate", label: "AI 生成", run: async (ctx) => {
        const { output, agentRunId } = await runAgent({ /* … */ });
        return { output, agent_run_id: agentRunId };
      },
      checkpoint: {           // ★ 审批门：引擎自动把该 step 挂 waiting_for_human
        type: "content", assigneeRole: "content_manager",
        title: (ctx, out) => `内容审核：${/* … */}`,
      } },
    { key: "apply", label: "落库", run: async (ctx) => {
        const gen = ctx.outputs["generate"];
        // prisma.$transaction 里写 content_reviews，带上 provenance
        return { saved: true };
      } },
  ],
  onRejected: async (ctx) => { /* 回退实体状态 */ },
};
```

最后到 `definitions/index.ts` 的 `registerAllWorkflows` 里注册。checkpoint 决策后引擎会自动 resume/`onRejected`；若审批还要触发**领域内**联动（如外联发送、合同生效），在 `checkpoint.service.ts` 里按 `checkpoint.type` 动态 import 你的 `onXxxApprovalDecided`（见现有 outreach/contract/payment 分支）。

### 3.7 Feature queries（`src/features/<domain>/queries.ts`）

每个域一个 query key factory，照抄 `outreach/queries.ts`：

```ts
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, apiFetchList } from "@/lib/api";
import type { XxxDto } from "@/shared/schemas/xxx";

export const xxxKeys = {
  all: ["xxx"] as const,
  list: (p: object) => ["xxx", "list", p] as const,
  detail: (id: string) => ["xxx", "detail", id] as const,
};

export function useXxxList(p: { status?: string; cursor?: string | null }) {
  return useQuery({
    queryKey: xxxKeys.list(p),
    queryFn: () => apiFetchList<XxxDto>("/xxx", { params: { ...p, limit: 20 } }),
    placeholderData: (prev) => prev,     // 翻页不闪
  });
}

export function useCreateXxx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: XxxCreateInput) => apiFetch<XxxDto>("/xxx", { method: "POST", body: input }),
    onSuccess: () => { toast.success("已创建"); void qc.invalidateQueries({ queryKey: xxxKeys.all }); },
    onError: (e) => toast.error(e.message),
  });
}
```

### 3.8 Feature components（`src/features/<domain>/components/*.tsx`）——★ 最容易翻车

**这是 W6 codex 最大的失误：把 10 个组件全塞进 `page.tsx`。** 见 §4 的黄金法则。每个自洽的 UI 块（一张卡片、一个对话框、一个状态菜单）是一个文件，`"use client"`，props 明确。跨域复用的（FilterSelect、CampaignCreatorSelect）进 `components/shared` 或该域 components 供他域 import。

### 3.9 Page（`src/app/(app)/<page>/page.tsx`）——只装配

```tsx
"use client";
import { Suspense } from "react";
// 从 features/<domain>/components import 所有 UI
export default function XxxPage() {
  return <Suspense><XxxPageInner /></Suspense>;
}
function XxxPageInner() {
  // 只有：查询 hooks、URL 筛选、列定义、把组件拼起来。目标 < 200 行。
}
```

### 3.10 Seed（`prisma/seed-<domain>.ts`）

- **幂等**：每个实体先 `findFirst` 再 `create`，可重复跑。
- **UUIDv7 陷阱**：本项目主键是 UUIDv7（时间前缀）。**绝不要 `id.slice(0, n)` 当唯一值**——同一次 seed 的行前缀相同，会撞唯一键。要取随机尾段 `id.slice(-12)` 或整段。（W6 的 `HT-SEED-${cc.id.slice(0,8)}` 就因此 P2002。）
- 中文演示数据，覆盖"进行中"的真实场景，让页面一打开就有内容可看。
- 在 `prisma/seed.ts` 主流程里按顺序调用。

### 3.11 Vitest（`*.test.ts`，与被测文件同目录）

核心逻辑必测：状态机转移合法/非法、租户隔离、计价、分页、审批门。用 **fake provider**，不打真实 API。跑 `pnpm test`。

### 3.12 E2E（`e2e/w<N>-<domain>.spec.ts`）

每波一条主流程冒烟。照抄 `e2e/w5-pipeline-brief.spec.ts`：`loginAsAdmin` → 走用户真实路径 → 断言可见文案。选择器要点见 §8。跑 `pnpm e2e`（需 dev + 已 seed；工作流类还需 `pnpm dev:worker`，且 `MODEL_PROVIDER=fake`）。

---

## 4. 前端拆分黄金法则（把 god page 扼杀在摇篮里）

W6 codex 写出了 806/794/379 行的 `page.tsx`。功能对，但这正是重写要消灭的东西。规则：

1. **`page.tsx` 目标 < 200 行。** 超了就是信号：有东西该抽走。
2. **`page.tsx` 里只允许**：`"use client"` 指令、查询/mutation hooks 调用、URL 筛选状态、TanStack Table 列定义、把 features 组件拼起来的 JSX。**不允许**在 `page.tsx` 里 `function XxxDialog()` / `function XxxCard()` 定义业务组件。
3. **每个组件一个文件**，放 `src/features/<domain>/components/`：对话框、卡片、状态菜单、详情面板、表单，各自成文件。
4. **出现第二次就抽走**：`FilterSelect`、`formatCents`、`CampaignCreatorSelect` 这种跨页重复的，进 `components/shared/` 或 `lib/`，绝不 copy-paste。
5. **没有死代码**：不可达的分支、`onValueChange={() => undefined}` 这种占位控件——删掉。（W6 的 AnalyzeDialog 就留了个坏 Select。）
6. **复用已有共享组件**：`AsyncBoundary`（四态 loading/error/empty/permission）、`DataTable`、`StatusTag`、`PermissionGate`、`ConfirmDialog`、`PageHeader`、`MetricCard`——不要重新造。

**参照物**：`src/features/outreach/components/` 和 `src/features/contracts/components/` 是 W6 重构后的样子，就照这个粒度写。

---

## 5. 每波「完成的定义」(DoD)

一波不满足全部这些就**不算完**：

- [ ] 后端：schema（如需）→ status 机 → repository → service → shared schema → route，全部齐全，命名/结构对齐 §3。
- [ ] AI（如涉及）：prompt + fake fixture + 落库溯源 + （工作流则）definition 已注册。
- [ ] 前端：`features/<domain>/queries.ts` + `components/*` + 瘦 `page.tsx`；四态齐全；权限门 `PermissionGate`。
- [ ] 导航：`components/layout/nav-config.ts` 里解锁本波路由（加进 `IMPLEMENTED_ROUTES`）。
- [ ] 审批门：涉及对外/资金/正式产物的，`checkpoint.service.ts` 已接线联动。
- [ ] Seed：新域有中文演示数据，幂等，`pnpm seed` 通过。
- [ ] 测试：vitest 覆盖核心逻辑；e2e 一条主流程冒烟。
- [ ] `pnpm check` 全绿（typecheck + lint + test）。
- [ ] `pnpm e2e` 相关 spec 通过（本地起 dev + seed）。
- [ ] 自查过 §4、§6，没有 god 组件 / 死代码 / seed 唯一键坑。
- [ ] 一个约定式提交，信息说清这波做了什么。

---

## 6. 反面教材：W6 codex 踩的 4 个坑（务必避开）

| # | 症状 | 根因 | 正确做法 |
|---|---|---|---|
| 1 | `page.tsx` 806 行，10 个组件挤在一起 | 没拆到 features/components | §4：每组件一文件，page 只装配 |
| 2 | seed `pnpm seed` P2002 唯一键冲突 | `id.slice(0,8)` 当唯一值，但 UUIDv7 前缀相同 | 取随机尾段 `id.slice(-12)` |
| 3 | AnalyzeDialog 里一个永远不触发的坏 Select | 复制逻辑没清理 | 删死代码，只留可达分支 |
| 4 | 没有 W6 的 e2e | 漏了 DoD | 每波必须一条冒烟 spec |

这四个都**没被 `pnpm check` 拦住**——所以别只信绿灯，要对照 DoD 和自检。

---

## 7. 交付前自检流程（每波跑一遍）

1. `pnpm check` —— 必须全绿。
2. `pnpm seed` —— 必须成功（验证 seed 幂等 + 无唯一键坑）。
3. `pnpm dev`（+ 需要时 `pnpm dev:worker`，`MODEL_PROVIDER=fake`）起本地，**用浏览器实际点一遍你这波的页面**：四态是否都对？权限角色（用 `viewer@demo.com`）访问写操作是否被挡？
4. `pnpm e2e` 相关 spec —— 通过。
5. 人肉扫一遍 diff：有没有 >200 行的 page？有没有 copy-paste？有没有 `any`？注释/文案是不是中文？
6. 通过后再提交。

演示账号（密码都是 `demo1234`）：`admin@demo.com`（全权限）、`manager@demo.com`、`kol@demo.com`、`viewer@demo.com`（只读，用来验证权限门）。

---

## 8. 技术栈陷阱速查

**Next.js 16**
- `middleware.ts` → `proxy.ts`（导出 `proxy`）。
- `page.tsx` 的 `params` 是 `Promise`，要 `const { id } = use(params)`（客户端）或 `await params`（服务端）。
- 客户端组件禁止 import `src/server/**`（ESLint 拦）。

**Prisma 7**
- 连接串在 `prisma.config.ts`，不是 schema 的 `url`；客户端经 `@prisma/adapter-pg`；生成到 `src/generated/prisma`。
- pgvector 列用 `Unsupported("vector(1536)")` + 原生 SQL 迁移建 HNSW 索引；检索用 `$queryRaw` 且 SQL 内强制 `tenant_id` 过滤。
- 改 schema：`pnpm db:migrate`；`db:reset` 会清库（谨慎）。

**BullMQ / worker**
- `jobId` **不能含 `:`**，用 `.` 分隔（如 `${runId}.${stepKey}`）。
- `ioredis` 锁定 `5.10.1`（匹配 bullmq）。
- 测试用独立队列前缀（`QUEUE_PREFIX`）避免 dev worker 抢测试 job。
- worker 入口 `src/worker/index.ts`，跑 `pnpm dev:worker`。

**状态机 / RBAC**
- 转移前 `assertTransition`；子状态（contract/payment/content 三个）是展示映射，无转移校验。
- 权限字符串在 `permissions.ts`，角色矩阵含 `*` 通配；页面用 `PermissionGate`，路由用 `createApiHandler({permission})`。

**Playwright 选择器（避免 flaky）**
- Next route-announcer 会占用 `getByRole("alert")` → 改用 `getByText`。
- toast 文案可能和表格单元格撞 → 用 `getByRole("cell")` 缩小范围。
- ConfirmDialog 的确认按钮文案 = `confirmLabel`（如"批准"），用 `getByRole("dialog").getByRole("button", { name: "批准" })` 锁定。
- shadcn Card 有 `data-slot="card"`，可用来定位卡片。
- 审批中心是共享的，测试串行（`workers: 1`，已配）。

---

## 9. 提交规范

- 约定式提交：`feat(scope): 简述`、`fix(scope): ...`、`refactor(scope): ...`。
- 每波一个（或少数几个）语义清晰的提交，别把 W7 全塞进一个 "wip"。
- 提交信息正文用中文说清"做了什么 / 为什么"。
- 结尾加：
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- **只在被明确要求时** push / 建 PR。

---

## 10. 参考坐标（照着仿写）

| 你要写的 | 直接参照仓库里的 |
|---|---|
| repository | `src/server/modules/contract/contract.repository.ts` |
| service + DTO + 审批门 | `src/server/modules/contract/contract.service.ts`、`outreach.service.ts` |
| route | `src/app/api/v1/contracts/route.ts` |
| shared schema | `src/shared/schemas/outreach.ts` |
| AI prompt + schema | `src/server/ai/prompts/outreach.ts`、`brief.ts` |
| fake fixture | `src/server/ai/router/fake.ts` |
| 工作流定义（含 checkpoint） | `src/server/workflows/definitions/research.ts`、`brief.ts` |
| 审批联动接线 | `src/server/modules/checkpoint/checkpoint.service.ts` |
| feature queries | `src/features/outreach/queries.ts` |
| feature 组件粒度 | `src/features/outreach/components/`、`src/features/contracts/components/` |
| 瘦 page | `src/app/(app)/outreach/[id]/page.tsx`（161 行） |
| seed（幂等 + UUIDv7） | `prisma/seed-campaigns.ts` |
| e2e | `e2e/w5-pipeline-brief.spec.ts`、`e2e/w6-outreach-contracts.spec.ts` |

> 每次动手前，先打开对应参照文件读一遍，再仿写。这比凭记忆强得多——尤其 Next 16 / Prisma 7 和你训练数据不一样。
