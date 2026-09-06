"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCampaigns } from "@/features/campaigns/queries";
import { useCreateContentAsset } from "@/features/content-review/queries";
import { CampaignCreatorSelect } from "@/features/outreach/components/campaign-creator-select";

const CONTENT_READY_STATUSES = new Set([
  "confirmed",
  "contracting",
  "active",
  "content_submitted",
  "published",
]);

export function CreateContentAssetDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const { data: campaigns } = useCampaigns({});
  const createAsset = useCreateContentAsset();
  const [campaignId, setCampaignId] = useState("");
  const [campaignCreatorId, setCampaignCreatorId] = useState("");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("video");
  const [platform, setPlatform] = useState("小红书");
  const [caption, setCaption] = useState("");
  const [url, setUrl] = useState("");

  const reset = () => {
    setCampaignId("");
    setCampaignCreatorId("");
    setTitle("");
    setContentType("video");
    setPlatform("小红书");
    setCaption("");
    setUrl("");
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>提交达人内容</DialogTitle>
          <DialogDescription>录入达人已提交的内容初稿，系统会自动绑定当前 Campaign 的已批准 Brief。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Campaign</FieldLabel>
            <Select
              value={campaignId}
              onValueChange={(value) => {
                setCampaignId(value);
                setCampaignCreatorId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择 Campaign" />
              </SelectTrigger>
              <SelectContent>
                {(campaigns?.items ?? []).map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {campaignId && (
            <CampaignCreatorSelect
              campaignId={campaignId}
              value={campaignCreatorId}
              onChange={setCampaignCreatorId}
              statuses={CONTENT_READY_STATUSES}
              description="仅显示已确认合作、签约中、执行中或已发布的达人。"
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>内容标题</FieldLabel>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>内容类型</FieldLabel>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">视频</SelectItem>
                  <SelectItem value="image">图文</SelectItem>
                  <SelectItem value="article">文章</SelectItem>
                  <SelectItem value="live">直播</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel>平台</FieldLabel>
              <Input value={platform} onChange={(event) => setPlatform(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>内容链接</FieldLabel>
              <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
              <FieldDescription>可留空，发布后再补正式链接。</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel>正文 / Caption</FieldLabel>
            <Textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={5}
              placeholder="粘贴达人初稿文案，AI 审核会结合 Brief 与品牌禁用词检查。"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            取消
          </Button>
          <Button
            disabled={!campaignCreatorId || !title || createAsset.isPending}
            onClick={() =>
              createAsset.mutate(
                {
                  campaign_creator_id: campaignCreatorId,
                  title,
                  content_type: contentType as "video" | "image" | "article" | "live",
                  platform,
                  caption: caption || null,
                  url: url || null,
                },
                {
                  onSuccess: (asset) => {
                    onCreated?.(asset.id);
                    handleClose(false);
                  },
                },
              )
            }
          >
            {createAsset.isPending ? "提交中…" : "提交内容"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
