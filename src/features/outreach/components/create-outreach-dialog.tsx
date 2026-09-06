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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCampaigns } from "@/features/campaigns/queries";
import { CampaignCreatorSelect } from "@/features/outreach/components/campaign-creator-select";
import { CONTACTABLE_STATUSES } from "@/features/outreach/constants";
import { useCreateOutreachThread } from "@/features/outreach/queries";

export function CreateOutreachDialog({
  open,
  onOpenChange,
  initialCampaignId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCampaignId?: string;
}) {
  const createThread = useCreateOutreachThread();
  const { data: campaigns } = useCampaigns({});
  const [campaignId, setCampaignId] = useState(initialCampaignId ?? "");
  const [campaignCreatorId, setCampaignCreatorId] = useState("");
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setCampaignId(initialCampaignId ?? "");
      setCampaignCreatorId("");
      setChannel("email");
      setSubject("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新建外联会话</DialogTitle>
          <DialogDescription>选择已进入执行阶段的 Campaign 达人，创建后可生成草稿或手动记录消息。</DialogDescription>
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
              statuses={CONTACTABLE_STATUSES}
              description="仅显示已批准、已触达、已回复、谈判中或已确认合作的达人。"
            />
          )}
          <Field>
            <FieldLabel>渠道</FieldLabel>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">邮件</SelectItem>
                <SelectItem value="dm_manual">手动私信</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>主题</FieldLabel>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            <FieldDescription>可留空，AI 起草时会生成邮件主题。</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            取消
          </Button>
          <Button
            disabled={!campaignCreatorId || createThread.isPending}
            onClick={() =>
              createThread.mutate(
                {
                  campaign_creator_id: campaignCreatorId,
                  channel,
                  subject: subject || null,
                },
                { onSuccess: () => handleClose(false) },
              )
            }
          >
            {createThread.isPending ? "创建中…" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
