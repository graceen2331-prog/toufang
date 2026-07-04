"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Eye, Pencil, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { WorkflowProgress } from "@/components/shared/workflow-progress";
import {
  briefKeys,
  useBriefVersion,
  useCampaignBrief,
  useSaveBriefVersion,
  useTransitionBriefStatus,
} from "@/features/briefs/queries";
import { useStartCampaignWorkflow } from "@/features/workflows/queries";
import { BRIEF_STATUS } from "@/shared/constants/status";
import type { BriefContent, BriefVersionDto } from "@/shared/schemas/brief";

// ---------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------

export function BriefTab({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const { data: brief, isLoading } = useCampaignBrief(campaignId);
  const start = useStartCampaignWorkflow();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [viewVersionId, setViewVersionId] = useState<string | null>(null);

  const handleGenerate = () => {
    start.mutate(
      { campaignId, key: "brief" },
      { onSuccess: (res) => setActiveRunId(res.workflow_run_id) },
    );
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  const progressCard = activeRunId && (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">生成进度</CardTitle>
      </CardHeader>
      <CardContent>
        <WorkflowProgress
          runId={activeRunId}
          onFinished={() => {
            void queryClient.invalidateQueries({ queryKey: briefKeys.byCampaign(campaignId) });
          }}
        />
      </CardContent>
    </Card>
  );

  // 空态：既无 Brief 也没有进行中的生成
  if (!brief) {
    return (
      <div className="space-y-4">
        {progressCard}
        {!activeRunId && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
            <Sparkles className="size-8 text-muted-foreground/50" />
            <p className="mt-3 font-medium">还没有创作 Brief</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              基于已批准的策略与产品信息，让 AI 生成达人创作 Brief 草案，可随时人工编辑修订。
            </p>
            <PermissionGate permission="ai:run">
              <Button className="mt-4" disabled={start.isPending} onClick={handleGenerate}>
                <Sparkles className="size-4" />
                {start.isPending ? "启动中…" : "AI 生成 Brief"}
              </Button>
            </PermissionGate>
          </div>
        )}
      </div>
    );
  }

  const locked = brief.status === "locked";
  const content = brief.current_version?.content ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-medium">{brief.title}</h2>
        <StatusTag source={BRIEF_STATUS} value={brief.status} />
        {brief.current_version && (
          <Badge variant="outline">v{brief.current_version.version}</Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <PermissionGate permission="brief:write">
            <BriefStatusMenu briefId={brief.id} currentStatus={brief.status} />
          </PermissionGate>
          <PermissionGate permission="brief:write">
            {locked ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button variant="outline" disabled>
                        <Pencil className="size-4" />
                        编辑
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>已锁定</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                编辑
              </Button>
            )}
          </PermissionGate>
          <PermissionGate permission="ai:run">
            <Button variant="outline" disabled={start.isPending} onClick={handleGenerate}>
              <Sparkles className="size-4" />
              {start.isPending ? "启动中…" : "AI 重新生成"}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {progressCard}

      {content && brief.current_version && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">当前版本内容</CardTitle>
          </CardHeader>
          <CardContent>
            <BriefContentView content={content} version={brief.current_version} />
          </CardContent>
        </Card>
      )}

      {brief.versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">版本历史</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {brief.versions.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2">
                  <span className="font-medium tabular-nums">v{v.version}</span>
                  {v.ai_generated ? (
                    <Badge variant="secondary">AI 生成</Badge>
                  ) : (
                    <Badge variant="outline">人工编辑</Badge>
                  )}
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {v.change_summary ?? "—"}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {format(new Date(v.created_at), "yyyy-MM-dd HH:mm")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setViewVersionId(v.id)}
                  >
                    <Eye className="size-4" />
                    查看
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <BriefVersionDialog
        briefId={brief.id}
        versionId={viewVersionId}
        onClose={() => setViewVersionId(null)}
      />

      {content && (
        <BriefEditSheet
          key={brief.current_version_id ?? "none"}
          campaignId={campaignId}
          content={content}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// 状态流转
// ---------------------------------------------------------------

function BriefStatusMenu({
  briefId,
  currentStatus,
}: {
  briefId: string;
  currentStatus: string;
}) {
  const transition = useTransitionBriefStatus();
  const targets = BRIEF_STATUS.transitions[currentStatus] ?? [];
  if (targets.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={transition.isPending}>
          推进状态
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>转移到</DropdownMenuLabel>
        {targets.map((to) => (
          <DropdownMenuItem key={to} onClick={() => transition.mutate({ briefId, to })}>
            <StatusTag source={BRIEF_STATUS} value={to} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------
// 内容展示
// ---------------------------------------------------------------

function BriefContentView({
  content,
  version,
}: {
  content: BriefContent;
  version: BriefVersionDto;
}) {
  return (
    <div className="space-y-6">
      {content.background && (
        <section>
          <h3 className="mb-2 text-sm font-medium">背景</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{content.background}</p>
        </section>
      )}

      {content.product_positioning && (
        <section>
          <h3 className="mb-2 text-sm font-medium">产品定位</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {content.product_positioning}
          </p>
        </section>
      )}

      {content.key_messages.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">核心信息</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {content.key_messages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </section>
      )}

      {content.must_include.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">必须包含</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {content.must_include.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {content.must_avoid.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">禁止出现</h3>
          <div className="flex flex-wrap gap-2">
            {content.must_avoid.map((item, i) => (
              <Badge key={i} variant="destructive">
                {item}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {content.cta && (
        <section>
          <h3 className="mb-2 text-sm font-medium">行动号召（CTA）</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{content.cta}</p>
        </section>
      )}

      {content.deliverables.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">交付物</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {content.deliverables.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.type}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.count}</TableCell>
                  <TableCell>{d.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {content.timeline_notes && (
        <section>
          <h3 className="mb-2 text-sm font-medium">时间要求</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{content.timeline_notes}</p>
        </section>
      )}

      {content.platform_requirements.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">平台要求</h3>
          <ul className="space-y-2 text-sm">
            {content.platform_requirements.map((pr, i) => (
              <li key={i} className="rounded-md border p-3">
                <p className="font-medium">{pr.platform}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {pr.requirements.map((req, j) => (
                    <li key={j}>{req}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="border-t pt-3 text-xs text-muted-foreground">
        {version.ai_generated ? (
          <>
            AI 生成 · 模型 {version.model ?? "—"} · Prompt {version.prompt_key ?? "—"}@
            {version.prompt_version ?? "—"}
          </>
        ) : (
          <>人工编辑 · {version.created_by_name ?? "—"}</>
        )}{" "}
        · {format(new Date(version.created_at), "yyyy-MM-dd HH:mm")}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// 历史版本查看
// ---------------------------------------------------------------

function BriefVersionDialog({
  briefId,
  versionId,
  onClose,
}: {
  briefId: string;
  versionId: string | null;
  onClose: () => void;
}) {
  const { data: version, isLoading } = useBriefVersion(
    briefId,
    versionId ?? "",
    versionId !== null,
  );

  return (
    <Dialog open={versionId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{version ? `历史版本 v${version.version}` : "历史版本"}</DialogTitle>
          <DialogDescription>历史版本为只读快照，如需修改请基于当前版本编辑。</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
        {version && <BriefContentView content={version.content} version={version} />}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------
// 编辑表单（Sheet）
// ---------------------------------------------------------------

const BriefFormSchema = z.object({
  title: z.string().min(1, "请输入标题").max(200, "标题最长 200 字"),
  background: z.string(),
  product_positioning: z.string(),
  key_messages: z.string(),
  must_include: z.string(),
  must_avoid: z.string(),
  cta: z.string(),
  deliverables: z.string(),
  timeline_notes: z.string(),
  platform_requirements: z.string(),
  change_summary: z.string().max(500, "修改说明最长 500 字"),
});
type BriefFormValues = z.infer<typeof BriefFormSchema>;

/** 按行拆分，去掉空行 */
function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** 每行 "类型|数量|说明" → 交付物 */
function parseDeliverables(value: string): BriefContent["deliverables"] {
  return splitLines(value).map((line) => {
    const [type = "", count = "", ...rest] = line.split("|");
    const n = Number(count.trim());
    return {
      type: type.trim(),
      count: Number.isFinite(n) && n > 0 ? Math.round(n) : 1,
      notes: rest.join("|").trim(),
    };
  });
}

/** 每行 "平台：要求1；要求2" → 平台要求 */
function parsePlatformRequirements(value: string): BriefContent["platform_requirements"] {
  return splitLines(value).map((line) => {
    const idx = line.search(/[:：]/);
    const platform = idx === -1 ? line : line.slice(0, idx);
    const rest = idx === -1 ? "" : line.slice(idx + 1);
    return {
      platform: platform.trim(),
      requirements: rest
        .split(/[;；]/)
        .map((r) => r.trim())
        .filter(Boolean),
    };
  });
}

function contentToFormValues(content: BriefContent): BriefFormValues {
  return {
    title: content.title,
    background: content.background,
    product_positioning: content.product_positioning,
    key_messages: content.key_messages.join("\n"),
    must_include: content.must_include.join("\n"),
    must_avoid: content.must_avoid.join("\n"),
    cta: content.cta,
    deliverables: content.deliverables.map((d) => `${d.type}|${d.count}|${d.notes}`).join("\n"),
    timeline_notes: content.timeline_notes,
    platform_requirements: content.platform_requirements
      .map((pr) => `${pr.platform}：${pr.requirements.join("；")}`)
      .join("\n"),
    change_summary: "",
  };
}

function BriefEditSheet({
  campaignId,
  content,
  open,
  onOpenChange,
}: {
  campaignId: string;
  content: BriefContent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveBriefVersion();
  const defaultValues = useMemo(() => contentToFormValues(content), [content]);
  const form = useForm<BriefFormValues>({
    resolver: zodResolver(BriefFormSchema),
    defaultValues,
  });

  // 每次打开时回填当前版本内容，丢弃上次未保存的编辑
  useEffect(() => {
    if (open) form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const onSubmit = form.handleSubmit((values) => {
    const next: BriefContent = {
      title: values.title,
      background: values.background.trim(),
      product_positioning: values.product_positioning.trim(),
      key_messages: splitLines(values.key_messages),
      must_include: splitLines(values.must_include),
      must_avoid: splitLines(values.must_avoid),
      cta: values.cta.trim(),
      deliverables: parseDeliverables(values.deliverables),
      timeline_notes: values.timeline_notes.trim(),
      platform_requirements: parsePlatformRequirements(values.platform_requirements),
    };
    save.mutate(
      {
        campaignId,
        content: next,
        change_summary: values.change_summary.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>编辑 Brief</SheetTitle>
          <SheetDescription>保存后生成新版本，状态回到「草稿」重新走审批。</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col">
          <FieldGroup className="px-4 pb-4">
            <Field data-invalid={!!form.formState.errors.title}>
              <FieldLabel htmlFor="bf-title">标题</FieldLabel>
              <Input id="bf-title" {...form.register("title")} />
              {form.formState.errors.title && (
                <FieldError>{form.formState.errors.title.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="bf-background">背景</FieldLabel>
              <Textarea id="bf-background" rows={3} {...form.register("background")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bf-positioning">产品定位</FieldLabel>
              <Textarea id="bf-positioning" rows={3} {...form.register("product_positioning")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bf-key-messages">核心信息</FieldLabel>
              <Textarea id="bf-key-messages" rows={4} {...form.register("key_messages")} />
              <FieldDescription>每行一条核心信息。</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="bf-must-include">必须包含</FieldLabel>
              <Textarea id="bf-must-include" rows={3} {...form.register("must_include")} />
              <FieldDescription>每行一条要求。</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="bf-must-avoid">禁止出现</FieldLabel>
              <Textarea id="bf-must-avoid" rows={3} {...form.register("must_avoid")} />
              <FieldDescription>每行一条禁忌项。</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="bf-cta">行动号召（CTA）</FieldLabel>
              <Input id="bf-cta" {...form.register("cta")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bf-deliverables">交付物</FieldLabel>
              <Textarea id="bf-deliverables" rows={4} {...form.register("deliverables")} />
              <FieldDescription>每行一条，格式：类型|数量|说明，如「短视频|2|60 秒以内」。</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="bf-timeline">时间要求</FieldLabel>
              <Textarea id="bf-timeline" rows={3} {...form.register("timeline_notes")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bf-platforms">平台要求</FieldLabel>
              <Textarea id="bf-platforms" rows={4} {...form.register("platform_requirements")} />
              <FieldDescription>
                每行一个平台，格式：平台：要求1；要求2，如「抖音：挂购物车；带话题标签」。
              </FieldDescription>
            </Field>
            <Field data-invalid={!!form.formState.errors.change_summary}>
              <FieldLabel htmlFor="bf-summary">修改说明（可选）</FieldLabel>
              <Input id="bf-summary" placeholder="如：补充平台合规要求" {...form.register("change_summary")} />
              {form.formState.errors.change_summary && (
                <FieldError>{form.formState.errors.change_summary.message}</FieldError>
              )}
            </Field>
          </FieldGroup>
          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "保存中…" : "保存新版本"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
