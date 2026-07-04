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
import { Textarea } from "@/components/ui/textarea";
import { useCampaigns } from "@/features/campaigns/queries";
import { useCreateContract } from "@/features/contracts/queries";
import { CampaignCreatorSelect } from "@/features/outreach/components/campaign-creator-select";
import { yuanToCents } from "@/lib/format";
import type { ContractDto } from "@/shared/schemas/outreach";

const CONTRACTABLE_STATUSES = new Set(["confirmed", "contracting", "active"]);

export function CreateContractDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contract: ContractDto) => void;
}) {
  const createContract = useCreateContract();
  const { data: campaigns } = useCampaigns({});
  const [campaignId, setCampaignId] = useState("");
  const [campaignCreatorId, setCampaignCreatorId] = useState("");
  const [amount, setAmount] = useState("");
  const [usageRights, setUsageRights] = useState("");
  const [exclusivityTerms, setExclusivityTerms] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setCampaignId("");
      setCampaignCreatorId("");
      setAmount("");
      setUsageRights("");
      setExclusivityTerms("");
      setPaymentTerms("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新建合同</DialogTitle>
          <DialogDescription>只能为已确认合作、签约中或执行中的 Campaign 达人创建合同。</DialogDescription>
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
              statuses={CONTRACTABLE_STATUSES}
              showPrice
              description="仅显示已确认合作、签约中或执行中的达人。"
            />
          )}
          <Field>
            <FieldLabel>合同金额（元）</FieldLabel>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>授权范围</FieldLabel>
            <Textarea rows={3} value={usageRights} onChange={(e) => setUsageRights(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>排他条款</FieldLabel>
            <Textarea rows={3} value={exclusivityTerms} onChange={(e) => setExclusivityTerms(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>付款条款</FieldLabel>
            <Textarea rows={3} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            disabled={!campaignCreatorId || !amount.trim() || createContract.isPending}
            onClick={() =>
              createContract.mutate(
                {
                  campaign_creator_id: campaignCreatorId,
                  amount_cents: yuanToCents(amount),
                  usage_rights: usageRights || null,
                  exclusivity_terms: exclusivityTerms || null,
                  payment_terms: paymentTerms || null,
                },
                {
                  onSuccess: (contract) => {
                    onCreated(contract);
                    close(false);
                  },
                },
              )
            }
          >
            {createContract.isPending ? "创建中…" : "创建合同"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
