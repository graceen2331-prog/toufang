"use client";

import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Field, FieldLabel } from "@/components/ui/field";
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
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { StatusTag } from "@/components/shared/status-tag";
import {
  useAddCampaignCreators,
  useCampaignCreators,
  useRemoveCampaignCreator,
  useTransitionCampaignCreator,
} from "@/features/campaigns/queries";
import { useCreators } from "@/features/creators/queries";
import {
  CAMPAIGN_CREATOR_STATUS,
  CONTENT_SUB_STATUS,
  CONTRACT_SUB_STATUS,
  PAYMENT_SUB_STATUS,
} from "@/shared/constants/status";
import { PLATFORM_LABELS } from "@/shared/schemas/creator";

const ROLE_LABELS: Record<string, string> = {
  hero: "主推",
  amplifier: "放大",
  seeder: "种草",
};

function formatCents(cents: number): string {
  return `¥${(cents / 100).toLocaleString("zh-CN")}`;
}

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform;
}

export function CampaignCreatorsTab({ campaignId }: { campaignId: string }) {
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
        <div className="overflow-x-auto border bg-card">
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
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((selectedId) => selectedId !== id)));
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
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto border">
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
                          {creator.platforms.slice(0, 3).map((platform) => (
                            <Badge key={platform} variant="outline" className="text-xs">
                              {platformLabel(platform)}
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
