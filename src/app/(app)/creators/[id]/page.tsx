"use client";

import { use, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { CreatorFormDialog } from "@/features/creators/components/creator-form-dialog";
import {
  useAddCreatorNote,
  useAddPlatformAccount,
  useCreator,
  useCreatorContact,
  useCreatorEvents,
  useCreatorNotes,
  useRemovePlatformAccount,
  useTransitionCreatorStatus,
} from "@/features/creators/queries";
import { CREATOR_RELATIONSHIP_STATUS, RISK_LEVEL } from "@/shared/constants/status";
import { PLATFORM_LABELS, PLATFORMS, PlatformAccountSchema } from "@/shared/schemas/creator";
import type { PlatformAccountInput } from "@/shared/schemas/creator";

function formatFollowers(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 万`;
  return String(n);
}

export default function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: creator, isLoading, isError, error, refetch } = useCreator(id);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<DetailSkeleton />}
    >
      {creator && (
        <div className="space-y-6">
          <PageHeader
            title={
              <span className="flex items-center gap-3">
                {creator.display_name}
                <StatusTag
                  source={CREATOR_RELATIONSHIP_STATUS}
                  value={creator.relationship_status}
                />
                <StatusTag source={RISK_LEVEL} value={creator.risk_level} />
              </span>
            }
            description={creator.bio ?? "暂无简介"}
            actions={
              <PermissionGate permission="creator:write">
                <StatusTransitionMenu
                  creatorId={creator.id}
                  currentStatus={creator.relationship_status}
                />
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" />
                  编辑
                </Button>
              </PermissionGate>
            }
          />

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="总粉丝量"
              value={formatFollowers(
                creator.platform_accounts.reduce((sum, a) => sum + a.followers, 0),
              )}
              hint={`${creator.platform_accounts.length} 个平台账号`}
            />
            <MetricCard
              label="最高互动率"
              value={
                creator.platform_accounts.length
                  ? `${Math.max(0, ...creator.platform_accounts.map((a) => a.engagement_rate)).toFixed(1)}%`
                  : "—"
              }
            />
            <MetricCard
              label="内容分类"
              value={
                <div className="flex flex-wrap gap-1 pt-1">
                  {creator.categories.length ? (
                    creator.categories.map((c) => (
                      <Badge key={c} variant="secondary">
                        {c}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-base">—</span>
                  )}
                </div>
              }
            />
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="accounts">平台账号</TabsTrigger>
              <TabsTrigger value="notes">笔记</TabsTrigger>
              <TabsTrigger value="events">动态</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <OverviewTab creator={creator} />
            </TabsContent>
            <TabsContent value="accounts" className="mt-4">
              <AccountsTab creatorId={creator.id} accounts={creator.platform_accounts} />
            </TabsContent>
            <TabsContent value="notes" className="mt-4">
              <NotesTab creatorId={creator.id} />
            </TabsContent>
            <TabsContent value="events" className="mt-4">
              <EventsTab creatorId={creator.id} />
            </TabsContent>
          </Tabs>

          <CreatorFormDialog open={editOpen} onOpenChange={setEditOpen} creator={creator} />
        </div>
      )}
    </AsyncBoundary>
  );
}

function StatusTransitionMenu({
  creatorId,
  currentStatus,
}: {
  creatorId: string;
  currentStatus: string;
}) {
  const transition = useTransitionCreatorStatus();
  const targets = CREATOR_RELATIONSHIP_STATUS.transitions[currentStatus] ?? [];
  if (targets.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={transition.isPending}>
          变更状态
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>转移到</DropdownMenuLabel>
        {targets.map((to) => (
          <DropdownMenuItem key={to} onClick={() => transition.mutate({ id: creatorId, to })}>
            <StatusTag source={CREATOR_RELATIONSHIP_STATUS} value={to} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OverviewTab({
  creator,
}: {
  creator: NonNullable<ReturnType<typeof useCreator>["data"]>;
}) {
  const [revealed, setRevealed] = useState(false);
  const contact = useCreatorContact(creator.id, revealed);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI 画像摘要</CardTitle>
        </CardHeader>
        <CardContent>
          {creator.profile_summary ? (
            <p className="text-sm whitespace-pre-wrap">{creator.profile_summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              暂无 AI 摘要。达人评分工作流上线后将自动生成。
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">联系方式</CardTitle>
        </CardHeader>
        <CardContent>
          {!creator.has_contact_info ? (
            <p className="text-sm text-muted-foreground">未录入联系方式</p>
          ) : !revealed ? (
            <PermissionGate
              permission="creator:contact:read"
              fallback={<p className="text-sm text-muted-foreground">你没有查看联系方式的权限</p>}
            >
              <Button variant="outline" size="sm" onClick={() => setRevealed(true)}>
                <Eye className="size-4" />
                查看联系方式（将记录审计）
              </Button>
            </PermissionGate>
          ) : contact.isLoading ? (
            <p className="text-sm text-muted-foreground">解密中…</p>
          ) : contact.isError ? (
            <p className="text-sm text-destructive">
              {contact.error instanceof Error ? contact.error.message : "获取失败"}
            </p>
          ) : (
            <dl className="space-y-1 text-sm">
              {Object.entries(contact.data ?? {}).map(([key, value]) =>
                value ? (
                  <div key={key} className="flex gap-2">
                    <dt className="w-20 text-muted-foreground">
                      {{ email: "邮箱", phone: "电话", wechat: "微信", agent_name: "经纪人", agent_contact: "经纪联系" }[key] ?? key}
                    </dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          )}
        </CardContent>
      </Card>
      {creator.tags.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">标签</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {creator.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AccountsTab({
  creatorId,
  accounts,
}: {
  creatorId: string;
  accounts: Array<{
    id: string;
    platform: string;
    handle: string;
    url: string | null;
    followers: number;
    engagement_rate: number;
    avg_views: number;
  }>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const remove = useRemovePlatformAccount();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PermissionGate permission="creator:write">
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            添加账号
          </Button>
        </PermissionGate>
      </div>
      {accounts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">还没有平台账号</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>平台</TableHead>
                <TableHead>账号</TableHead>
                <TableHead className="text-right">粉丝</TableHead>
                <TableHead className="text-right">互动率</TableHead>
                <TableHead className="text-right">平均播放</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {PLATFORM_LABELS[a.platform as keyof typeof PLATFORM_LABELS] ?? a.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        @{a.handle}
                      </a>
                    ) : (
                      <span className="font-medium">@{a.handle}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatFollowers(a.followers)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.engagement_rate ? `${a.engagement_rate.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.avg_views ? formatFollowers(a.avg_views) : "—"}
                  </TableCell>
                  <TableCell>
                    <PermissionGate permission="creator:write">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove.mutate({ creatorId, accountId: a.id })}
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
      )}
      <AddAccountDialog creatorId={creatorId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddAccountDialog({
  creatorId,
  open,
  onOpenChange,
}: {
  creatorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddPlatformAccount();
  const form = useForm<PlatformAccountInput>({
    resolver: zodResolver(PlatformAccountSchema),
    defaultValues: { platform: "douyin", handle: "", url: "", followers: 0, engagement_rate: 0, avg_views: 0 },
  });

  const onSubmit = form.handleSubmit((values) => {
    add.mutate(
      { creatorId, input: values },
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
          <DialogTitle>添加平台账号</DialogTitle>
          <DialogDescription>同平台同账号在组织内唯一。</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>平台</FieldLabel>
                <Select
                  defaultValue="douyin"
                  onValueChange={(v) =>
                    form.setValue("platform", v as PlatformAccountInput["platform"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PLATFORM_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={!!form.formState.errors.handle}>
                <FieldLabel htmlFor="a-handle">账号</FieldLabel>
                <Input id="a-handle" placeholder="不含 @" {...form.register("handle")} />
                {form.formState.errors.handle && (
                  <FieldError>{form.formState.errors.handle.message}</FieldError>
                )}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="a-url">主页链接（可选）</FieldLabel>
              <Input id="a-url" placeholder="https://…" {...form.register("url")} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field>
                <FieldLabel htmlFor="a-followers">粉丝数</FieldLabel>
                <Input id="a-followers" type="number" min="0" {...form.register("followers", { valueAsNumber: true })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="a-er">互动率 %</FieldLabel>
                <Input id="a-er" type="number" min="0" step="0.1" {...form.register("engagement_rate", { valueAsNumber: true })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="a-views">平均播放</FieldLabel>
                <Input id="a-views" type="number" min="0" {...form.register("avg_views", { valueAsNumber: true })} />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "保存中…" : "添加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotesTab({ creatorId }: { creatorId: string }) {
  const { data: notes, isLoading } = useCreatorNotes(creatorId);
  const addNote = useAddCreatorNote();
  const [content, setContent] = useState("");

  return (
    <div className="space-y-4">
      <PermissionGate permission="creator:write">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!content.trim()) return;
            addNote.mutate(
              { creatorId, content: content.trim() },
              { onSuccess: () => setContent("") },
            );
          }}
        >
          <Textarea
            placeholder="记录沟通要点、合作偏好、注意事项…"
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button type="submit" disabled={addNote.isPending || !content.trim()}>
            添加
          </Button>
        </form>
      </PermissionGate>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : !notes?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">暂无笔记</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border bg-card p-3">
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {note.created_by_name ?? "未知"} · {format(new Date(note.created_at), "yyyy-MM-dd HH:mm")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventsTab({ creatorId }: { creatorId: string }) {
  const { data: events, isLoading } = useCreatorEvents(creatorId);
  if (isLoading) return <p className="text-sm text-muted-foreground">加载中…</p>;
  return (
    <StatusTimeline events={events ?? []} source={CREATOR_RELATIONSHIP_STATUS} />
  );
}
