"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBrands } from "@/features/brands/queries";
import { useConvertBrandLead } from "@/features/brand-leads/queries";
import { CAMPAIGN_OBJECTIVES } from "@/shared/schemas/campaign";
import type { BrandLeadDto } from "@/shared/schemas/brand-lead";

const NEW_BRAND = "__new__";
const PLATFORM_OPTIONS = [
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "bilibili", label: "B站" },
  { value: "weibo", label: "微博" },
] as const;

function splitList(value: string): string[] {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function BrandLeadConvertDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: BrandLeadDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const brands = useBrands();
  const convert = useConvertBrandLead();
  const suggestedName = lead.name_zh ?? lead.name;
  const [brandChoice, setBrandChoice] = useState(NEW_BRAND);
  const [brandName, setBrandName] = useState(suggestedName);
  const [brandDescription, setBrandDescription] = useState(
    lead.brand_profile_zh ?? lead.description ?? "",
  );
  const [campaignName, setCampaignName] = useState(`${suggestedName} 合作 Campaign`);
  const [objective, setObjective] = useState("");
  const [markets, setMarkets] = useState(lead.country ?? "");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [creativeDirection, setCreativeDirection] = useState(lead.campaign_angles.join("；"));
  const [validationError, setValidationError] = useState<string | null>(null);

  function togglePlatform(value: string, checked: boolean) {
    setPlatforms((current) =>
      checked ? [...new Set([...current, value])] : current.filter((item) => item !== value),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignName.trim()) {
      setValidationError("请输入 Campaign 名称");
      return;
    }
    if (!objective) {
      setValidationError("请选择 Campaign 目标");
      return;
    }
    if (brandChoice === NEW_BRAND && !brandName.trim()) {
      setValidationError("请输入品牌名称");
      return;
    }
    setValidationError(null);
    convert.mutate(
      {
        id: lead.id,
        input: {
          existing_brand_id: brandChoice === NEW_BRAND ? null : brandChoice,
          brand_name: brandChoice === NEW_BRAND ? brandName.trim() : null,
          brand_description: brandChoice === NEW_BRAND ? brandDescription.trim() || null : null,
          campaign_name: campaignName.trim(),
          objective: objective as keyof typeof CAMPAIGN_OBJECTIVES,
          markets: splitList(markets),
          platforms,
          creative_direction: creativeDirection.trim() || null,
        },
      },
      {
        onSuccess: (result) => {
          onOpenChange(false);
          router.push(`/campaigns/${result.campaign_id}`);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>从品牌机会发起 Campaign</DialogTitle>
          <DialogDescription>
            来源画像只用于预填建议。品牌归属、营销目标和投放平台需由你确认后才会写入业务数据。
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <Field>
            <FieldLabel>品牌归属</FieldLabel>
            <Select value={brandChoice} onValueChange={setBrandChoice}>
              <SelectTrigger aria-label="品牌归属">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_BRAND}>创建新品牌</SelectItem>
                {(brands.data?.items ?? []).map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    使用现有品牌：{brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {brandChoice === NEW_BRAND && (
            <>
              <Field>
                <FieldLabel htmlFor="lead-brand-name">品牌名称</FieldLabel>
                <Input
                  id="lead-brand-name"
                  value={brandName}
                  onChange={(event) => setBrandName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="lead-brand-description">品牌描述</FieldLabel>
                <Textarea
                  id="lead-brand-description"
                  rows={3}
                  value={brandDescription}
                  onChange={(event) => setBrandDescription(event.target.value)}
                />
                <FieldDescription>来自 CES 资料的建议，可编辑或删除。</FieldDescription>
              </Field>
            </>
          )}

          <Field>
            <FieldLabel htmlFor="lead-campaign-name">Campaign 名称</FieldLabel>
            <Input
              id="lead-campaign-name"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Campaign 目标</FieldLabel>
              <Select value={objective} onValueChange={setObjective}>
                <SelectTrigger aria-label="Campaign 目标">
                  <SelectValue placeholder="请选择目标" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CAMPAIGN_OBJECTIVES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-markets">目标市场</FieldLabel>
              <Input
                id="lead-markets"
                value={markets}
                onChange={(event) => setMarkets(event.target.value)}
                placeholder="用逗号分隔"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>投放平台</FieldLabel>
            <div className="grid grid-cols-2 gap-2 rounded-none border p-3 sm:grid-cols-4">
              {PLATFORM_OPTIONS.map((platform) => (
                <label key={platform.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={platforms.includes(platform.value)}
                    onCheckedChange={(checked) => togglePlatform(platform.value, checked === true)}
                  />
                  {platform.label}
                </label>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="lead-creative-direction">创意方向</FieldLabel>
            <Textarea
              id="lead-creative-direction"
              rows={3}
              value={creativeDirection}
              onChange={(event) => setCreativeDirection(event.target.value)}
            />
            <FieldDescription>
              将作为 Campaign 目标备注保存，不包含机会评分或融资推断。
            </FieldDescription>
          </Field>

          {validationError && <p className="text-sm text-destructive">{validationError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={convert.isPending}>
              {convert.isPending ? "创建中…" : "创建并进入 Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
