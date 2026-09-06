# Campaign Inline Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 Campaign inline workbench so a user can see and decide current Campaign approvals without leaving the Campaign detail page.

**Architecture:** Add a reliable backend `campaign_id` filter for approvals, extract the existing approval card into a reusable feature component, then add a Campaign-side action rail that renders pending approvals and stage guidance. Keep global `/approvals` intact and reuse the same decision mutation so approval behavior and audit paths stay unified.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query, Vitest, Playwright, Prisma 7 generated client, shadcn/radix UI components, Tailwind CSS.

---

## File Structure

- Create `src/server/modules/checkpoint/checkpoint.repository.test.ts`
  - Unit tests for campaign approval entity ref collection and Prisma where construction.
- Modify `src/server/modules/checkpoint/checkpoint.repository.ts`
  - Add `campaignId` to list params.
  - Add `collectCampaignCheckpointRefs`.
  - Add `buildCampaignCheckpointWhere`.
  - Apply the campaign filter in `list`.
- Modify `src/app/api/v1/approvals/route.ts`
  - Pass `campaign_id` search param into `listCheckpoints`.
- Create `src/features/approvals/components/approval-card.tsx`
  - Move the current approval card UI out of `/approvals/page.tsx`.
  - Add a `density` prop for normal list cards and compact rail cards.
- Modify `src/app/(app)/approvals/page.tsx`
  - Import and render the reusable `ApprovalCard`.
  - Remove the internal `ApprovalCard` implementation and unused imports.
- Create `src/features/campaigns/components/campaign-action-rail.tsx`
  - Query pending approvals for one campaign.
  - Render compact approval cards and next-step guidance.
- Modify `src/app/(app)/campaigns/[id]/page.tsx`
  - Wrap existing Tabs in a two-column layout and render `CampaignActionRail`.
- Modify `src/components/shared/workflow-progress.tsx`
  - Replace forced `/approvals` jump with an inline mode message.
- Add or modify `e2e/w9-acceptance.spec.ts`
  - Cover approving from the Campaign page without navigating to `/approvals`.

---

### Task 1: Add Campaign-Aware Approval Filtering

**Files:**
- Create: `src/server/modules/checkpoint/checkpoint.repository.test.ts`
- Modify: `src/server/modules/checkpoint/checkpoint.repository.ts`
- Modify: `src/app/api/v1/approvals/route.ts`

- [ ] **Step 1: Write the failing repository tests**

Create `src/server/modules/checkpoint/checkpoint.repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildCampaignCheckpointWhere,
  type CampaignCheckpointRefs,
} from "./checkpoint.repository";

describe("Campaign 审批过滤", () => {
  it("构造能覆盖工作流、外联、合同、付款、内容和报告的审批查询条件", () => {
    const refs: CampaignCheckpointRefs = {
      campaignCreatorIds: ["cc-1"],
      contentAssetIds: ["asset-1"],
      contractIds: ["contract-1"],
      outreachMessageIds: ["msg-1"],
      paymentRecordIds: ["payment-1"],
      reportIds: ["report-1"],
    };

    const where = buildCampaignCheckpointWhere("campaign-1", refs);

    expect(where.OR).toEqual(
      expect.arrayContaining([
        { entityType: "campaign", entityId: "campaign-1" },
        { entityType: "outreach_message", entityId: { in: ["msg-1"] } },
        { entityType: "contract", entityId: { in: ["contract-1"] } },
        { entityType: "payment_record", entityId: { in: ["payment-1"] } },
        { entityType: "content_asset", entityId: { in: ["asset-1"] } },
        { entityType: "report", entityId: { in: ["report-1"] } },
      ]),
    );
    expect(where.OR).toEqual(
      expect.arrayContaining([
        {
          workflowRun: {
            is: {
              OR: [
                { subjectType: "campaign", subjectId: "campaign-1" },
                { subjectType: "content_asset", subjectId: { in: ["asset-1"] } },
              ],
            },
          },
        },
      ]),
    );
  });

  it("没有关联实体时仍保留 Campaign 工作流审批条件", () => {
    const where = buildCampaignCheckpointWhere("campaign-1", {
      campaignCreatorIds: [],
      contentAssetIds: [],
      contractIds: [],
      outreachMessageIds: [],
      paymentRecordIds: [],
      reportIds: [],
    });

    expect(where.OR).toEqual([
      { entityType: "campaign", entityId: "campaign-1" },
      {
        workflowRun: {
          is: {
            OR: [{ subjectType: "campaign", subjectId: "campaign-1" }],
          },
        },
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm vitest run src/server/modules/checkpoint/checkpoint.repository.test.ts
```

Expected: FAIL because `buildCampaignCheckpointWhere` and `CampaignCheckpointRefs` are not exported.

- [ ] **Step 3: Implement campaign-aware repository filtering**

Modify `src/server/modules/checkpoint/checkpoint.repository.ts`:

```ts
import "server-only";
import { prisma } from "@/server/db/client";
import type { HumanCheckpoint, Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export interface CheckpointListParams {
  limit: number;
  cursor: string | null;
  order: "asc" | "desc";
  status: string | null;
  type: string | null;
  campaignId?: string | null;
}

export interface CampaignCheckpointRefs {
  campaignCreatorIds: string[];
  contentAssetIds: string[];
  contractIds: string[];
  outreachMessageIds: string[];
  paymentRecordIds: string[];
  reportIds: string[];
}

function idsCondition(ids: string[]): { in: string[] } | undefined {
  return ids.length > 0 ? { in: ids } : undefined;
}

export function buildCampaignCheckpointWhere(
  campaignId: string,
  refs: CampaignCheckpointRefs,
): Prisma.HumanCheckpointWhereInput {
  const workflowSubjects: Prisma.WorkflowRunWhereInput[] = [
    { subjectType: "campaign", subjectId: campaignId },
  ];
  const ors: Prisma.HumanCheckpointWhereInput[] = [
    { entityType: "campaign", entityId: campaignId },
  ];

  const outreachMessageIds = idsCondition(refs.outreachMessageIds);
  if (outreachMessageIds) ors.push({ entityType: "outreach_message", entityId: outreachMessageIds });

  const contractIds = idsCondition(refs.contractIds);
  if (contractIds) ors.push({ entityType: "contract", entityId: contractIds });

  const paymentRecordIds = idsCondition(refs.paymentRecordIds);
  if (paymentRecordIds) ors.push({ entityType: "payment_record", entityId: paymentRecordIds });

  const contentAssetIds = idsCondition(refs.contentAssetIds);
  if (contentAssetIds) {
    ors.push({ entityType: "content_asset", entityId: contentAssetIds });
    workflowSubjects.push({ subjectType: "content_asset", subjectId: contentAssetIds });
  }

  const reportIds = idsCondition(refs.reportIds);
  if (reportIds) ors.push({ entityType: "report", entityId: reportIds });

  ors.push({
    workflowRun: {
      is: {
        OR: workflowSubjects,
      },
    },
  });

  return { OR: ors };
}

async function collectCampaignCheckpointRefs(
  ctx: TenantCtx,
  campaignId: string,
): Promise<CampaignCheckpointRefs> {
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
    select: { id: true },
  });
  const campaignCreatorIds = campaignCreators.map((item) => item.id);

  const [threads, contentAssets, contracts, reports] = await Promise.all([
    campaignCreatorIds.length
      ? prisma.outreachThread.findMany({
          where: { tenantId: ctx.orgId, campaignCreatorId: { in: campaignCreatorIds }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
    campaignCreatorIds.length
      ? prisma.contentAsset.findMany({
          where: { tenantId: ctx.orgId, campaignCreatorId: { in: campaignCreatorIds }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
    campaignCreatorIds.length
      ? prisma.contract.findMany({
          where: { tenantId: ctx.orgId, campaignCreatorId: { in: campaignCreatorIds }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
    prisma.report.findMany({
      where: { tenantId: ctx.orgId, campaignId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const threadIds = threads.map((item) => item.id);
  const contractIds = contracts.map((item) => item.id);

  const [messages, payments] = await Promise.all([
    threadIds.length
      ? prisma.outreachMessage.findMany({
          where: { tenantId: ctx.orgId, threadId: { in: threadIds }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
    contractIds.length
      ? prisma.paymentRecord.findMany({
          where: { tenantId: ctx.orgId, contractId: { in: contractIds }, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    campaignCreatorIds,
    contentAssetIds: contentAssets.map((item) => item.id),
    contractIds,
    outreachMessageIds: messages.map((item) => item.id),
    paymentRecordIds: payments.map((item) => item.id),
    reportIds: reports.map((item) => item.id),
  };
}

export const checkpointRepository = {
  async list(ctx: TenantCtx, params: CheckpointListParams): Promise<HumanCheckpoint[]> {
    const campaignWhere = params.campaignId
      ? buildCampaignCheckpointWhere(
          params.campaignId,
          await collectCampaignCheckpointRefs(ctx, params.campaignId),
        )
      : {};

    return prisma.humanCheckpoint.findMany({
      where: {
        tenantId: ctx.orgId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.cursor
          ? { id: params.order === "desc" ? { lt: params.cursor } : { gt: params.cursor } }
          : {}),
        ...campaignWhere,
      },
      orderBy: { id: params.order },
      take: params.limit + 1,
    });
  },

  async countPending(ctx: TenantCtx): Promise<number> {
    return prisma.humanCheckpoint.count({ where: { tenantId: ctx.orgId, status: "pending" } });
  },

  async findById(ctx: TenantCtx, id: string): Promise<HumanCheckpoint | null> {
    return prisma.humanCheckpoint.findFirst({ where: { id, tenantId: ctx.orgId } });
  },

  async create(
    ctx: TenantCtx,
    data: Omit<Prisma.HumanCheckpointUncheckedCreateInput, "tenantId">,
  ): Promise<HumanCheckpoint> {
    return prisma.humanCheckpoint.create({
      data: { ...data, tenantId: ctx.orgId, createdBy: ctx.userId ?? null },
    });
  },

  async decide(
    ctx: TenantCtx,
    id: string,
    status: "approved" | "rejected" | "changes_requested",
    reason: string | null,
  ): Promise<boolean> {
    const result = await prisma.humanCheckpoint.updateMany({
      where: { id, tenantId: ctx.orgId, status: "pending" },
      data: {
        status,
        decidedBy: ctx.userId ?? null,
        decidedAt: new Date(),
        decisionReason: reason,
      },
    });
    return result.count > 0;
  },
};
```

- [ ] **Step 4: Pass `campaign_id` through the approvals API**

Modify `src/app/api/v1/approvals/route.ts`:

```ts
const { items, pagination } = await listCheckpoints(
  { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
  {
    ...query,
    status: ctx.searchParams.get("status"),
    type: ctx.searchParams.get("type"),
    campaignId: ctx.searchParams.get("campaign_id"),
  },
);
```

- [ ] **Step 5: Verify backend filtering**

Run:

```bash
pnpm vitest run src/server/modules/checkpoint/checkpoint.repository.test.ts
pnpm typecheck
```

Expected: both commands pass.

---

### Task 2: Extract Reusable ApprovalCard

**Files:**
- Create: `src/features/approvals/components/approval-card.tsx`
- Modify: `src/app/(app)/approvals/page.tsx`

- [ ] **Step 1: Create the reusable approval card**

Create `src/features/approvals/components/approval-card.tsx` by moving the current `ApprovalCard` implementation from `src/app/(app)/approvals/page.tsx`. Keep behavior the same and add `density?: "default" | "compact"`.

Key exported signature:

```ts
export function ApprovalCard({
  checkpoint,
  density = "default",
}: {
  checkpoint: CheckpointDto;
  density?: "default" | "compact";
}) {
  // same approve/reject behavior as the existing page-local card
}
```

Compact mode differences:

```tsx
<Card className={density === "compact" ? "py-3 shadow-none" : "py-4"}>
  <CardContent
    className={
      density === "compact"
        ? "space-y-3 px-3"
        : "flex items-start justify-between gap-4 px-4"
    }
  >
    {/* compact stacks actions below content; default keeps actions on the right */}
  </CardContent>
</Card>
```

Keep these imports in the new file:

```ts
import { useState } from "react";
import { format } from "date-fns";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { ApprovalPayloadSummary } from "@/features/approvals/components/approval-payload-summary";
import { useDecideApproval } from "@/features/approvals/queries";
import { CHECKPOINT_STATUS } from "@/shared/constants/status";
import { CHECKPOINT_TYPE_LABELS, type CheckpointDto } from "@/shared/schemas/checkpoint";
```

- [ ] **Step 2: Update ApprovalsPage to use the reusable card**

Modify `src/app/(app)/approvals/page.tsx`:

```ts
import { ApprovalCard } from "@/features/approvals/components/approval-card";
```

Remove the local `ApprovalCard` function and imports that only it used:

```ts
import { format } from "date-fns";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { ApprovalPayloadSummary } from "@/features/approvals/components/approval-payload-summary";
import { useDecideApproval } from "@/features/approvals/queries";
```

Keep `useApprovals` imported:

```ts
import { useApprovals } from "@/features/approvals/queries";
```

- [ ] **Step 3: Verify the extraction**

Run:

```bash
pnpm typecheck
pnpm eslint src/app/(app)/approvals/page.tsx src/features/approvals/components/approval-card.tsx
```

Expected: both commands pass and no behavior changes in `/approvals`.

---

### Task 3: Add CampaignActionRail

**Files:**
- Create: `src/features/campaigns/components/campaign-action-rail.tsx`
- Modify: `src/features/approvals/queries.ts`

- [ ] **Step 1: Extend approval query params**

Modify `src/features/approvals/queries.ts`:

```ts
export interface ApprovalFilters {
  status?: string;
  type?: string;
  campaign_id?: string;
  cursor?: string | null;
  limit?: number;
}
```

And pass the new params:

```ts
params: {
  status: params.status,
  type: params.type,
  campaign_id: params.campaign_id,
  cursor: params.cursor,
  limit: params.limit ?? 20,
},
```

- [ ] **Step 2: Create CampaignActionRail**

Create `src/features/campaigns/components/campaign-action-rail.tsx`:

```tsx
"use client";

import { AlertCircle, CheckCircle2, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ApprovalCard } from "@/features/approvals/components/approval-card";
import { useApprovals } from "@/features/approvals/queries";
import {
  getStageDecision,
  STAGE_LABELS,
} from "@/features/campaigns/components/campaign-stage-decisions";
import { nextStage } from "@/features/campaigns/components/campaign-stage-flow";

const STAGE_GUIDES: Record<string, string[]> = {
  draft: ["补齐基础信息与预算", "生成或确认策略草案", "准备进入策略制定"],
  strategy: ["审批策略草案", "确认平台预算与达人组合", "推进到市场研究"],
  research: ["完成市场/竞品研究", "沉淀关键风险与内容机会", "推进到达人发现"],
  creator_discovery: ["运行达人发现", "确认候选池质量", "进入筛选与评分"],
  shortlisting: ["完成达人评分", "审批 shortlist", "把关键达人推进到已批准"],
  brief_creation: ["生成并编辑 Brief", "提交内容负责人确认", "准备进入触达"],
  outreach: ["发送外联草稿", "记录回复和档期", "有意向达人进入谈判"],
  negotiation: ["确认报价、授权和排期", "沉淀谈判结论", "推进签约"],
  contracting: ["登记合同与审批门", "确认付款节点", "推进内容制作"],
  content_creation: ["跟进达人交付物", "收集内容初稿", "提交内容审核"],
  content_review: ["处理 AI findings", "完成人工复核", "安排发布"],
  publishing: ["确认发布时间与链接", "记录发布状态", "进入数据回收"],
  metrics_collection: ["录入各平台指标", "检查 KPI 缺口", "生成复盘分析"],
  reporting: ["生成 Campaign 报告", "审批正式报告", "归档知识与复盘"],
  completed: ["Campaign 已完成", "复盘结论可沉淀到知识库"],
};

export function CampaignActionRail({
  campaignId,
  campaignStatus,
}: {
  campaignId: string;
  campaignStatus: string;
}) {
  const approvals = useApprovals({
    status: "pending",
    campaign_id: campaignId,
    limit: 8,
  });
  const items = approvals.data?.items ?? [];
  const decision = getStageDecision(campaignStatus);
  const next = nextStage(campaignStatus);
  const guides = STAGE_GUIDES[campaignStatus] ?? ["确认当前阶段产物", "再推进到下一阶段"];

  return (
    <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4 text-primary" />
            当前 Campaign 待办
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {items.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            isLoading={approvals.isLoading}
            isError={approvals.isError}
            error={approvals.error}
            onRetry={() => approvals.refetch()}
            isEmpty={items.length === 0}
            emptyTitle="当前 Campaign 暂无待处理事项"
            emptyHint="审批、工作流暂停和高优先级动作会出现在这里。"
          >
            <div className="space-y-3">
              {items.map((checkpoint) => (
                <ApprovalCard key={checkpoint.id} checkpoint={checkpoint} density="compact" />
              ))}
            </div>
          </AsyncBoundary>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="size-4 text-primary" />
            下一步
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">当前阶段</p>
            <p className="mt-1 font-medium">{STAGE_LABELS[campaignStatus] ?? campaignStatus}</p>
          </div>
          {next && (
            <div>
              <p className="text-xs text-muted-foreground">建议推进</p>
              <p className="mt-1 font-medium text-primary">推进到「{STAGE_LABELS[next]}」</p>
            </div>
          )}
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">审批门</p>
            <p className="mt-1 leading-relaxed">{decision.approvalGate}</p>
          </div>
          <ul className="space-y-2 text-muted-foreground">
            {guides.map((guide) => (
              <li key={guide} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{guide}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </aside>
  );
}
```

- [ ] **Step 3: Verify the rail component**

Run:

```bash
pnpm typecheck
pnpm eslint src/features/campaigns/components/campaign-action-rail.tsx src/features/approvals/queries.ts
```

Expected: both commands pass.

---

### Task 4: Integrate the Rail Into Campaign Detail and Inline Workflow Messaging

**Files:**
- Modify: `src/app/(app)/campaigns/[id]/page.tsx`
- Modify: `src/components/shared/workflow-progress.tsx`
- Modify: `src/features/campaigns/components/campaign-stage-flow.tsx`
- Modify: `src/features/briefs/components/brief-tab.tsx`

- [ ] **Step 1: Add the rail to Campaign detail**

Modify `src/app/(app)/campaigns/[id]/page.tsx`:

```ts
import { CampaignActionRail } from "@/features/campaigns/components/campaign-action-rail";
```

Wrap the existing Tabs:

```tsx
<CampaignStageFlow campaignId={campaign.id} currentStatus={campaign.status} />

<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
  <Tabs defaultValue="overview" className="min-w-0">
    {/* existing tabs remain here */}
  </Tabs>
  <CampaignActionRail campaignId={campaign.id} campaignStatus={campaign.status} />
</div>
```

- [ ] **Step 2: Add inline approval mode to WorkflowProgress**

Modify `src/components/shared/workflow-progress.tsx` signature:

```ts
export function WorkflowProgress({
  runId,
  onFinished,
  inlineApproval = false,
}: {
  runId: string;
  onFinished?: (status: string) => void;
  inlineApproval?: boolean;
}) {
```

Replace the pending checkpoint block with:

```tsx
{run.pending_checkpoint_id && (
  <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/30 bg-warning/15 p-3 text-sm">
    <ShieldCheck className="size-4 shrink-0" />
    <span className="flex-1">
      {inlineApproval
        ? "工作流已暂停，请在当前 Campaign 的待办栏处理审批后继续执行。"
        : "工作流已暂停，等待人工审批后继续执行。"}
    </span>
    {!inlineApproval && (
      <Button asChild size="sm" variant="outline">
        <Link href="/approvals">前往审批中心</Link>
      </Button>
    )}
  </div>
)}
```

- [ ] **Step 3: Enable inline mode in Campaign workflow surfaces**

Modify `src/features/campaigns/components/campaign-stage-flow.tsx`:

```tsx
<WorkflowProgress
  runId={activeRun.runId}
  inlineApproval
  onFinished={() => {
    void queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    void queryClient.invalidateQueries({ queryKey: workflowKeys.all });
  }}
/>
```

Modify `src/features/briefs/components/brief-tab.tsx` in both `WorkflowProgress` usages:

```tsx
<WorkflowProgress
  runId={activeRunId}
  inlineApproval
  onFinished={() => {
    void queryClient.invalidateQueries({ queryKey: briefKeys.byCampaign(campaignId) });
  }}
/>
```

- [ ] **Step 4: Verify page integration**

Run:

```bash
pnpm typecheck
pnpm eslint 'src/app/(app)/campaigns/[id]/page.tsx' src/components/shared/workflow-progress.tsx src/features/campaigns/components/campaign-stage-flow.tsx src/features/briefs/components/brief-tab.tsx
```

Expected: both commands pass.

---

### Task 5: Add End-to-End Coverage and Final Verification

**Files:**
- Modify: `e2e/w9-acceptance.spec.ts`

- [ ] **Step 1: Add an e2e test for Campaign inline approval**

Append a focused test to `e2e/w9-acceptance.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email = "admin@demo.com") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("demo1234");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("Campaign 详情页内可直接处理当前 Campaign 审批", async ({ page }) => {
  await login(page);

  await page.goto("/campaigns");
  await page.getByRole("link", { name: /查看详情|详情/ }).first().click();
  await expect(page).toHaveURL(/\/campaigns\/[0-9a-f-]+/);

  await expect(page.getByText("当前 Campaign 待办")).toBeVisible();

  const rail = page.locator("aside").filter({ hasText: "当前 Campaign 待办" }).first();
  const approveButton = rail.getByRole("button", { name: "批准" }).first();

  if ((await approveButton.count()) === 0) {
    test.skip(true, "当前 seed 没有该 Campaign 的 pending 审批");
  }

  await approveButton.click();
  await page.getByRole("dialog").getByRole("button", { name: "批准" }).click();
  await expect(page.getByText("已批准").first()).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/campaigns\/[0-9a-f-]+/);
});
```

If `w9-acceptance.spec.ts` already has a `login` helper and imports, reuse them instead of duplicating imports.

- [ ] **Step 2: Run unit checks**

Run:

```bash
pnpm check
```

Expected: typecheck, lint, and all Vitest tests pass.

- [ ] **Step 3: Run a browser smoke test**

Start the app:

```bash
pnpm dev
```

In another command, run a Playwright smoke script:

```bash
node --input-type=module - <<'NODE'
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.getByLabel('邮箱').fill('admin@demo.com');
await page.getByLabel('密码').fill('demo1234');
await page.getByRole('button', { name: '登录' }).click();
await page.waitForURL(/\\/dashboard/, { timeout: 10_000 });
await page.goto('http://localhost:3000/campaigns', { waitUntil: 'networkidle' });
await page.getByRole('link', { name: /查看详情|详情/ }).first().click();
await page.getByText('当前 Campaign 待办').waitFor({ timeout: 10_000 });

await browser.close();
if (errors.length > 0) {
  console.error(errors.join('\\n'));
  process.exit(1);
}
console.log('Campaign inline workbench smoke passed');
NODE
```

Expected: the script prints `Campaign inline workbench smoke passed`.

- [ ] **Step 4: Commit implementation**

Commit only files touched by this plan:

```bash
git add \
  src/server/modules/checkpoint/checkpoint.repository.test.ts \
  src/server/modules/checkpoint/checkpoint.repository.ts \
  src/app/api/v1/approvals/route.ts \
  src/features/approvals/components/approval-card.tsx \
  'src/app/(app)/approvals/page.tsx' \
  src/features/approvals/queries.ts \
  src/features/campaigns/components/campaign-action-rail.tsx \
  'src/app/(app)/campaigns/[id]/page.tsx' \
  src/components/shared/workflow-progress.tsx \
  src/features/campaigns/components/campaign-stage-flow.tsx \
  src/features/briefs/components/brief-tab.tsx \
  e2e/w9-acceptance.spec.ts

git commit -m "feat(campaign): 内联处理 Campaign 待办审批"
```

Expected: commit succeeds without staging unrelated dirty files.

---

## Self-Review

- Spec coverage:
  - Campaign detail inline approvals: Task 3 and Task 4.
  - Reusable approval card: Task 2.
  - No approval gate bypass: Task 2 uses `useDecideApproval`; backend remains `decideCheckpoint`.
  - Keep global approvals page: Task 2 modifies it to reuse the same card, not remove it.
  - Workflow no forced jump: Task 4.
  - Testing: Task 1 and Task 5.
- Placeholder scan:
  - No `TBD`, `TODO`, or “implement later” steps.
  - All changed files have exact paths.
- Type consistency:
  - API and frontend both use `campaign_id`.
  - Repository params use `campaignId`.
  - `CampaignActionRail` receives `campaignId` and `campaignStatus`.
  - `WorkflowProgress` uses `inlineApproval`.

