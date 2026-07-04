"use client";

import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCampaignCreators } from "@/features/campaigns/queries";
import { formatCents } from "@/lib/format";
import type { CampaignCreatorDto } from "@/shared/schemas/campaign";

export function CampaignCreatorSelect({
  campaignId,
  value,
  onChange,
  statuses,
  showPrice = false,
  description,
}: {
  campaignId: string;
  value: string;
  onChange: (value: string) => void;
  statuses: Set<string>;
  showPrice?: boolean;
  description?: string;
}) {
  const { data: creators, isLoading } = useCampaignCreators(campaignId);
  const options = (creators ?? []).filter((cc: CampaignCreatorDto) => statuses.has(cc.status));
  return (
    <Field>
      <FieldLabel>达人</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "加载中…" : "选择达人"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((cc) => (
            <SelectItem key={cc.id} value={cc.id}>
              {cc.creator_name} · {cc.status}
              {showPrice && cc.agreed_price_cents ? ` · ${formatCents(cc.agreed_price_cents)}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}
