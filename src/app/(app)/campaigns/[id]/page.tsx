"use client";

import { use, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AsyncBoundary, DetailSkeleton } from "@/components/shared/async-boundary";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { StrategyTab } from "@/features/campaigns/components/strategy-tab";
import {
  useAddCampaignCreators,
  useCampaign,
  useCampaignBudget,
  useCampaignCreators,
  useCampaignEvents,
  useCampaignTasks,
  useCreateBudgetItem,
  useCreateTask,
  useDeleteBudgetItem,
  useDeleteTask,
  useRemoveCampaignCreator,
  useTransitionCampaignCreator,
  useTransitionCampaignStatus,
  useUpdateTask,
} from "@/features/campaigns/queries";
import { useCreators } from "@/features/creators/queries";
import {
  CAMPAIGN_CREATOR_STATUS,
  CAMPAIGN_HEALTH,
  CAMPAIGN_STATUS,
  CONTENT_SUB_STATUS,
  CONTRACT_SUB_STATUS,
  PAYMENT_SUB_STATUS,
} from "@/shared/constants/status";
import {
  BUDGET_CATEGORY_LABELS,
  CAMPAIGN_OBJECTIVES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/shared/schemas/campaign";
import type {
  BudgetItemInput,
  CampaignDetailDto,
  CampaignTaskInput,
} from "@/shared/schemas/campaign";
import { PLATFORM_LABELS } from "@/shared/schemas/creator";

const ROLE_LABELS: Record<string, string> = {
  hero: "主推",
  amplifier: "放大",
  seeder: "种草",
};

const GOAL_LABELS: Record<string, string> = {
  impressions: "曝光目标",
  engagement: "互动目标",
  clicks: "点击目标",
  conversions: "转化目标",
  roi: "ROI 目标",
  notes: "备注",
};

function formatCents(cents: number): string {
  return `¥${(cents / 100).toLocaleString("zh-CN")}`;
}

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] ?? p;
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: campaign, isLoading, isError, error, refetch } = useCampaign(id);

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<DetailSkeleton />}
    >
      {campaign && (
        <div className="space-y-6">
          <PageHeader
            title={
              <span className="flex items-center gap-3">
                {campaign.name}
                <StatusTag source={CAMPAIGN_STATUS} value={campaign.status} />
                <StatusTag source={CAMPAIGN_HEALTH} value={campaign.health_status} />
              </span>
            }
            description={`${campaign.brand_name}${campaign.product_name ? ` · ${campaign.product_name}` : ""}`}
            actions={
              <PermissionGate permission="campaign:status">
                <StatusTransitionMenu campaignId={campaign.id} currentStatus={campaign.status} />
              </PermissionGate>
            }
          />

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="总预算" value={formatCents(campaign.budget_total_cents)} />
            <MetricCard
              label="已用预算"
              value={formatCents(campaign.budget_used_cents)}
              hint={
                campaign.budget_total_cents > 0
                  ? `占比 ${((campaign.budget_used_cents / campaign.budget_total_cents) * 100).toFixed(1)}%`
                  : undefined
              }
            />
            <MetricCard label="达人数" value={campaign.creator_count} />
            <MetricCard label="待办任务" value={campaign.task_open_count} />
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="strategy">策略</TabsTrigger>
              <TabsTrigger value="creators">达人</TabsTrigger>
              <TabsTrigger value="tasks">任务</TabsTrigger>
              <TabsTrigger value="budget">预算</TabsTrigger>
              <TabsTrigger value="timeline">时间线</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <OverviewTab campaign={campaign} />
            </TabsContent>
            <TabsContent value="strategy" className="mt-4">
              <StrategyTab campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="creators" className="mt-4">
              <CreatorsTab campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="tasks" className="mt-4">
              <TasksTab campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="budget" className="mt-4">
              <BudgetTab campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              <TimelineTab campaignId={campaign.id} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AsyncBoundary>
  );
}

// ---------------------------------------------------------------
// 状态推进
// ---------------------------------------------------------------

function StatusTransitionMenu({
  campaignId,
  currentStatus,
}: {
  campaignId: string;
  currentStatus: string;
}) {
  const transition = useTransitionCampaignStatus();
  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const targets = CAMPAIGN_STATUS.transitions[currentStatus] ?? [];
  if (targets.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={transition.isPending}>
            推进状态
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>转移到</DropdownMenuLabel>
          {targets.map((to) => (
            <DropdownMenuItem key={to} onClick={() => setPendingTo(to)}>
              <StatusTag source={CAMPAIGN_STATUS} value={to} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={pendingTo !== null}
        onOpenChange={(open) => !open && setPendingTo(null)}
        title="确认变更 Campaign 状态？"
        description={
          pendingTo && (
            <span className="flex items-center gap-2">
              <StatusTag source={CAMPAIGN_STATUS} value={currentStatus} />
              <span>→</span>
              <StatusTag source={CAMPAIGN_STATUS} value={pendingTo} />
            </span>
          )
        }
        confirmLabel="确认变更"
        destructive={false}
        pending={transition.isPending}
        onConfirm={() => {
          if (!pendingTo) return;
          transition.mutate(
            { id: campaignId, to: pendingTo },
            { onSuccess: () => setPendingTo(null) },
          );
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------
// 概览
// ---------------------------------------------------------------

function OverviewTab({ campaign }: { campaign: CampaignDetailDto }) {
  const goalEntries = Object.entries(campaign.goals).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <InfoRow label="品牌" value={campaign.brand_name} />
            <InfoRow label="产品" value={campaign.product_name ?? "—"} />
            <InfoRow
              label="营销目标"
              value={
                campaign.objective
                  ? (CAMPAIGN_OBJECTIVES[campaign.objective as keyof typeof CAMPAIGN_OBJECTIVES] ??
                    campaign.objective)
                  : "—"
              }
            />
            <InfoRow
              label="目标市场"
              value={campaign.markets.length ? campaign.markets.join("、") : "—"}
            />
            <InfoRow
              label="投放平台"
              value={
                campaign.platforms.length ? (
                  <span className="flex flex-wrap gap-1">
                    {campaign.platforms.map((p) => (
                      <Badge key={p} variant="outline">
                        {platformLabel(p)}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <InfoRow
              label="周期"
              value={
                campaign.start_date || campaign.end_date
                  ? `${campaign.start_date ?? "待定"} ~ ${campaign.end_date ?? "待定"}`
                  : "—"
              }
            />
            <InfoRow label="负责人" value={campaign.owner_name ?? "—"} />
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">KPI 目标</CardTitle>
        </CardHeader>
        <CardContent>
          {goalEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">未设定 KPI 目标</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {goalEntries.map(([key, value]) => (
                <InfoRow
                  label={GOAL_LABELS[key] ?? key}
                  value={
                    typeof value === "number" ? (
                      <span className="tabular-nums">{value.toLocaleString("zh-CN")}</span>
                    ) : (
                      String(value)
                    )
                  }
                  key={key}
                />
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------
// 达人
// ---------------------------------------------------------------

function CreatorsTab({ campaignId }: { campaignId: string }) {
  const { data: creators, isLoading, isError, error, refetch } = useCampaignCreators(campaignId);
  const transition = useTransitionCampaignCreator();
  const remove = useRemoveCampaignCreator();
  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PermissionGate permission="campaign:write">
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            添加达人
          </Button>
        </PermissionGate>
      </div>
      <AsyncBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={creators?.length === 0}
        emptyTitle="还没有合作达人"
        emptyHint="点击「添加达人」从达人库选择候选人"
      >
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>达人</TableHead>
                <TableHead>主状态</TableHead>
                <TableHead>合同</TableHead>
                <TableHead>付款</TableHead>
                <TableHead>内容</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="text-right">报价</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(creators ?? []).map((cc) => {
                const targets = CAMPAIGN_CREATOR_STATUS.transitions[cc.status] ?? [];
                return (
                  <TableRow key={cc.id}>
                    <TableCell className="font-medium">{cc.creator_name}</TableCell>
                    <TableCell>
                      <StatusTag source={CAMPAIGN_CREATOR_STATUS} value={cc.status} />
                    </TableCell>
                    <TableCell>
                      <StatusTag source={CONTRACT_SUB_STATUS} value={cc.contract_status} />
                    </TableCell>
                    <TableCell>
                      <StatusTag source={PAYMENT_SUB_STATUS} value={cc.payment_status} />
                    </TableCell>
                    <TableCell>
                      <StatusTag source={CONTENT_SUB_STATUS} value={cc.content_status} />
                    </TableCell>
                    <TableCell>
                      {cc.role ? (
                        <Badge variant="secondary">{ROLE_LABELS[cc.role] ?? cc.role}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cc.quoted_price_cents !== null ? formatCents(cc.quoted_price_cents) : "—"}
                    </TableCell>
                    <TableCell>
                      <PermissionGate permission="campaign:write">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              操作
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {targets.length > 0 && (
                              <>
                                <DropdownMenuLabel>推进主状态</DropdownMenuLabel>
                                {targets.map((to) => (
                                  <DropdownMenuItem
                                    key={to}
                                    onClick={() =>
                                      transition.mutate({ campaignId, ccId: cc.id, to })
                                    }
                                  >
                                    <StatusTag source={CAMPAIGN_CREATOR_STATUS} value={to} />
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setRemoveId(cc.id)}
                            >
                              <Trash2 className="size-4" />
                              移除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </AsyncBoundary>
      <AddCreatorsDialog
        campaignId={campaignId}
        open={addOpen}
        onOpenChange={setAddOpen}
        existingCreatorIds={new Set((creators ?? []).map((cc) => cc.creator_id))}
      />
      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(open) => !open && setRemoveId(null)}
        title="确认移除该达人？"
        description="移除后可重新从达人库添加，相关状态记录仍保留在事件日志中。"
        confirmLabel="移除"
        pending={remove.isPending}
        onConfirm={() => {
          if (!removeId) return;
          remove.mutate({ campaignId, ccId: removeId }, { onSuccess: () => setRemoveId(null) });
        }}
      />
    </div>
  );
}

function AddCreatorsDialog({
  campaignId,
  open,
  onOpenChange,
  existingCreatorIds,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCreatorIds: Set<string>;
}) {
  const add = useAddCampaignCreators();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [role, setRole] = useState("hero");
  const { data, isLoading } = useCreators({ q: q || undefined });

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((s) => s !== id)));
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setSelected([]);
      setQ("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加达人</DialogTitle>
          <DialogDescription>从达人库中选择候选人，加入后初始状态为「候选」。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索达人名称"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
            ) : !data?.items.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">没有匹配的达人</p>
            ) : (
              <ul className="divide-y">
                {data.items.map((creator) => {
                  const exists = existingCreatorIds.has(creator.id);
                  return (
                    <li key={creator.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 ${exists ? "opacity-50" : ""}`}
                      >
                        <Checkbox
                          checked={exists || selected.includes(creator.id)}
                          disabled={exists}
                          onCheckedChange={(checked) => toggle(creator.id, checked === true)}
                        />
                        <span className="flex-1 font-medium">{creator.display_name}</span>
                        <span className="flex gap-1">
                          {creator.platforms.slice(0, 3).map((p) => (
                            <Badge key={p} variant="outline" className="text-xs">
                              {platformLabel(p)}
                            </Badge>
                          ))}
                        </span>
                        {exists && <span className="text-xs text-muted-foreground">已添加</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Field>
            <FieldLabel>合作角色</FieldLabel>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            取消
          </Button>
          <Button
            disabled={selected.length === 0 || add.isPending}
            onClick={() =>
              add.mutate(
                { campaignId, creator_ids: selected, role },
                { onSuccess: () => handleClose(false) },
              )
            }
          >
            {add.isPending ? "添加中…" : `添加（${selected.length}）`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------
// 任务
// ---------------------------------------------------------------

function TasksTab({ campaignId }: { campaignId: string }) {
  const { data: tasks, isLoading, isError, error, refetch } = useCampaignTasks(campaignId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PermissionGate permission="campaign:write">
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            新建任务
          </Button>
        </PermissionGate>
      </div>
      <AsyncBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={tasks?.length === 0}
        emptyTitle="暂无任务"
        emptyHint="点击「新建任务」记录 Campaign 待办事项"
      >
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>优先级</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>截止日</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tasks ?? []).map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="font-medium">{task.title}</div>
                    {task.description && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {task.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <PermissionGate
                      permission="campaign:write"
                      fallback={
                        <Badge variant="secondary">
                          {TASK_STATUS_LABELS[task.status] ?? task.status}
                        </Badge>
                      }
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            {TASK_STATUS_LABELS[task.status] ?? task.status}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>切换状态</DropdownMenuLabel>
                          {(["todo", "in_progress", "done", "cancelled"] as const)
                            .filter((s) => s !== task.status)
                            .map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() =>
                                  updateTask.mutate({
                                    campaignId,
                                    taskId: task.id,
                                    input: { status: s },
                                  })
                                }
                              >
                                {TASK_STATUS_LABELS[s]}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </PermissionGate>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.assignee_name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {task.due_at ? (
                      format(new Date(task.due_at), "yyyy-MM-dd")
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PermissionGate permission="campaign:write">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(task.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </PermissionGate>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AsyncBoundary>
      <TaskFormDialog campaignId={campaignId} open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="确认删除该任务？"
        confirmLabel="删除"
        pending={deleteTask.isPending}
        onConfirm={() => {
          if (!deleteId) return;
          deleteTask.mutate(
            { campaignId, taskId: deleteId },
            { onSuccess: () => setDeleteId(null) },
          );
        }}
      />
    </div>
  );
}

const TaskFormSchema = z.object({
  title: z.string().min(1, "请输入任务标题").max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});
type TaskFormValues = z.infer<typeof TaskFormSchema>;

function TaskFormDialog({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateTask();
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(TaskFormSchema),
    defaultValues: { title: "", description: "", priority: "normal" },
  });

  const onSubmit = form.handleSubmit((values) => {
    const input: CampaignTaskInput = {
      title: values.title,
      description: values.description?.trim() || null,
      priority: values.priority,
    };
    create.mutate(
      { campaignId, input },
      {
        onSuccess: () => {
          onOpenChange(false);
          form.reset();
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
          <DialogDescription>记录 Campaign 执行过程中的待办事项。</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.title}>
              <FieldLabel htmlFor="t-title">标题</FieldLabel>
              <Input id="t-title" placeholder="如：确认首发达人档期" {...form.register("title")} />
              {form.formState.errors.title && (
                <FieldError>{form.formState.errors.title.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="t-desc">描述（可选）</FieldLabel>
              <Textarea id="t-desc" rows={3} {...form.register("description")} />
            </Field>
            <Field>
              <FieldLabel>优先级</FieldLabel>
              <Select
                defaultValue="normal"
                onValueChange={(v) => form.setValue("priority", v as TaskFormValues["priority"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "保存中…" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------
// 预算
// ---------------------------------------------------------------

function BudgetTab({ campaignId }: { campaignId: string }) {
  const { data: items, isLoading, isError, error, refetch } = useCampaignBudget(campaignId);
  const deleteItem = useDeleteBudgetItem();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      (items ?? []).reduce(
        (acc, item) => ({
          planned: acc.planned + item.planned_cents,
          reserved: acc.reserved + item.reserved_cents,
          spent: acc.spent + item.spent_cents,
        }),
        { planned: 0, reserved: 0, spent: 0 },
      ),
    [items],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PermissionGate permission="campaign:write">
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            新建预算项
          </Button>
        </PermissionGate>
      </div>
      <AsyncBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={items?.length === 0}
        emptyTitle="暂无预算项"
        emptyHint="点击「新建预算项」拆分 Campaign 预算"
      >
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类目</TableHead>
                <TableHead>名称</TableHead>
                <TableHead className="text-right">计划</TableHead>
                <TableHead className="text-right">预占</TableHead>
                <TableHead className="text-right">已花</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="secondary">
                      {BUDGET_CATEGORY_LABELS[item.category] ?? item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(item.planned_cents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(item.reserved_cents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(item.spent_cents)}
                  </TableCell>
                  <TableCell>
                    <PermissionGate permission="campaign:write">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </PermissionGate>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-medium">
                <TableCell colSpan={2}>合计</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCents(totals.planned)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCents(totals.reserved)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCents(totals.spent)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </AsyncBoundary>
      <BudgetItemDialog campaignId={campaignId} open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="确认删除该预算项？"
        confirmLabel="删除"
        pending={deleteItem.isPending}
        onConfirm={() => {
          if (!deleteId) return;
          deleteItem.mutate(
            { campaignId, itemId: deleteId },
            { onSuccess: () => setDeleteId(null) },
          );
        }}
      />
    </div>
  );
}

function budgetNumericField(message: string) {
  return z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), message);
}

const BudgetFormSchema = z.object({
  category: z.enum(["creator_fee", "production", "media", "other"]),
  name: z.string().min(1, "请输入预算项名称").max(200),
  planned_yuan: budgetNumericField("请输入有效金额"),
  reserved_yuan: budgetNumericField("请输入有效金额"),
  spent_yuan: budgetNumericField("请输入有效金额"),
});
type BudgetFormValues = z.infer<typeof BudgetFormSchema>;

function toCents(value: string | undefined): number {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : Math.round(n * 100);
}

function BudgetItemDialog({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateBudgetItem();
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(BudgetFormSchema),
    defaultValues: {
      category: "creator_fee",
      name: "",
      planned_yuan: "",
      reserved_yuan: "",
      spent_yuan: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const input: BudgetItemInput = {
      category: values.category,
      name: values.name,
      planned_cents: toCents(values.planned_yuan),
      reserved_cents: toCents(values.reserved_yuan),
      spent_cents: toCents(values.spent_yuan),
    };
    create.mutate(
      { campaignId, input },
      {
        onSuccess: () => {
          onOpenChange(false);
          form.reset();
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建预算项</DialogTitle>
          <DialogDescription>金额以元填写，系统按分存储。</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>类目</FieldLabel>
                <Select
                  defaultValue="creator_fee"
                  onValueChange={(v) =>
                    form.setValue("category", v as BudgetFormValues["category"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BUDGET_CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="b-name">名称</FieldLabel>
                <Input id="b-name" placeholder="如：头部达人合作费" {...form.register("name")} />
                {form.formState.errors.name && (
                  <FieldError>{form.formState.errors.name.message}</FieldError>
                )}
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field data-invalid={!!form.formState.errors.planned_yuan}>
                <FieldLabel htmlFor="b-planned">计划（元）</FieldLabel>
                <Input
                  id="b-planned"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("planned_yuan")}
                />
              </Field>
              <Field data-invalid={!!form.formState.errors.reserved_yuan}>
                <FieldLabel htmlFor="b-reserved">预占（元）</FieldLabel>
                <Input
                  id="b-reserved"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("reserved_yuan")}
                />
              </Field>
              <Field data-invalid={!!form.formState.errors.spent_yuan}>
                <FieldLabel htmlFor="b-spent">已花（元）</FieldLabel>
                <Input
                  id="b-spent"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("spent_yuan")}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "保存中…" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------
// 时间线
// ---------------------------------------------------------------

function TimelineTab({ campaignId }: { campaignId: string }) {
  const { data: events, isLoading } = useCampaignEvents(campaignId);
  if (isLoading) return <p className="text-sm text-muted-foreground">加载中…</p>;
  return <StatusTimeline events={events ?? []} source={CAMPAIGN_STATUS} />;
}
