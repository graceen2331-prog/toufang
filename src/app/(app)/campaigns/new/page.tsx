"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { useBrands } from "@/features/brands/queries";
import { useCreateCampaign } from "@/features/campaigns/queries";
import { useProducts } from "@/features/products/queries";
import { CAMPAIGN_OBJECTIVES } from "@/shared/schemas/campaign";
import type { CampaignCreateInput } from "@/shared/schemas/campaign";

/** 平台固定清单（Campaign 投放平台） */
const PLATFORM_OPTIONS = [
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "bilibili", label: "B站" },
  { value: "weibo", label: "微博" },
  { value: "kuaishou", label: "快手" },
] as const;

/** 非负数字文本字段（空 = 不填） */
function numericField(message: string) {
  return z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), message);
}

const FormSchema = z.object({
  name: z.string().min(1, "请输入 Campaign 名称").max(200),
  brand_id: z.string().min(1, "请选择品牌"),
  product_id: z.string().optional(),
  objective: z.string().optional(),
  markets: z.string().optional(),
  budget_total_yuan: numericField("请输入有效的预算金额"),
  goal_impressions: numericField("请输入有效数字"),
  goal_engagement: numericField("请输入有效数字"),
  goal_conversions: numericField("请输入有效数字"),
  goal_roi: numericField("请输入有效数字"),
  goal_notes: z.string().max(1000).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const create = useCreateCampaign();
  const { data: brands } = useBrands();
  const [platforms, setPlatforms] = useState<string[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      brand_id: "",
      product_id: "",
      objective: "",
      markets: "",
      budget_total_yuan: "",
      goal_impressions: "",
      goal_engagement: "",
      goal_conversions: "",
      goal_roi: "",
      goal_notes: "",
      start_date: "",
      end_date: "",
    },
  });

  const brandId = useWatch({ control: form.control, name: "brand_id" });
  const productId = useWatch({ control: form.control, name: "product_id" });
  const objective = useWatch({ control: form.control, name: "objective" });
  const { data: products } = useProducts(brandId ? { brandId } : {});

  const togglePlatform = (value: string, checked: boolean) => {
    setPlatforms((prev) => (checked ? [...prev, value] : prev.filter((p) => p !== value)));
  };

  const onSubmit = form.handleSubmit((values) => {
    const goals: CampaignCreateInput["goals"] = {};
    const impressions = toNumber(values.goal_impressions);
    const engagement = toNumber(values.goal_engagement);
    const conversions = toNumber(values.goal_conversions);
    const roi = toNumber(values.goal_roi);
    if (impressions > 0) goals.impressions = impressions;
    if (engagement > 0) goals.engagement = engagement;
    if (conversions > 0) goals.conversions = conversions;
    if (roi > 0) goals.roi = roi;
    if (values.goal_notes?.trim()) goals.notes = values.goal_notes.trim();

    const payload: CampaignCreateInput = {
      name: values.name,
      brand_id: values.brand_id,
      product_id: values.product_id || null,
      objective: values.objective || null,
      markets: splitList(values.markets),
      platforms,
      budget_total_cents: Math.round(toNumber(values.budget_total_yuan) * 100),
      currency: "CNY",
      goals,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
    };
    create.mutate(payload, {
      onSuccess: (campaign) => router.push(`/campaigns/${campaign.id}`),
    });
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="新建 Campaign"
        description="填写基础信息即可创建；达人、任务与预算明细可在创建后的详情页补充。"
      />

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本信息</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="cp-name">Campaign 名称</FieldLabel>
                <Input
                  id="cp-name"
                  placeholder="如：夏季防晒新品种草计划"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <FieldError>{form.formState.errors.name.message}</FieldError>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={!!form.formState.errors.brand_id}>
                  <FieldLabel>品牌</FieldLabel>
                  <Select
                    value={brandId || ""}
                    onValueChange={(v) => {
                      form.setValue("brand_id", v, { shouldValidate: true });
                      form.setValue("product_id", "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择品牌" />
                    </SelectTrigger>
                    <SelectContent>
                      {(brands?.items ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.brand_id && (
                    <FieldError>{form.formState.errors.brand_id.message}</FieldError>
                  )}
                </Field>
                <Field>
                  <FieldLabel>产品（可选）</FieldLabel>
                  <Select
                    value={productId || "none"}
                    onValueChange={(v) => form.setValue("product_id", v === "none" ? "" : v)}
                    disabled={!brandId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择产品" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不关联产品</SelectItem>
                      {(products?.items ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!brandId && <FieldDescription>先选择品牌后可关联产品</FieldDescription>}
                </Field>
              </div>
              <Field>
                <FieldLabel>营销目标</FieldLabel>
                <Select
                  value={objective || "none"}
                  onValueChange={(v) => form.setValue("objective", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择目标" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">暂不设定</SelectItem>
                    {Object.entries(CAMPAIGN_OBJECTIVES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">市场与平台</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cp-markets">目标市场</FieldLabel>
                <Input
                  id="cp-markets"
                  placeholder="逗号分隔，如：中国大陆，港澳台"
                  {...form.register("markets")}
                />
              </Field>
              <Field>
                <FieldLabel>投放平台</FieldLabel>
                <div className="flex flex-wrap gap-4 pt-1">
                  {PLATFORM_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={platforms.includes(opt.value)}
                        onCheckedChange={(checked) => togglePlatform(opt.value, checked === true)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">预算与 KPI</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.budget_total_yuan}>
                <FieldLabel htmlFor="cp-budget">总预算（元）</FieldLabel>
                <Input
                  id="cp-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  {...form.register("budget_total_yuan")}
                />
                {form.formState.errors.budget_total_yuan && (
                  <FieldError>{form.formState.errors.budget_total_yuan.message}</FieldError>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field data-invalid={!!form.formState.errors.goal_impressions}>
                  <FieldLabel htmlFor="cp-impressions">曝光目标</FieldLabel>
                  <Input
                    id="cp-impressions"
                    type="number"
                    min="0"
                    {...form.register("goal_impressions")}
                  />
                </Field>
                <Field data-invalid={!!form.formState.errors.goal_engagement}>
                  <FieldLabel htmlFor="cp-engagement">互动目标</FieldLabel>
                  <Input
                    id="cp-engagement"
                    type="number"
                    min="0"
                    {...form.register("goal_engagement")}
                  />
                </Field>
                <Field data-invalid={!!form.formState.errors.goal_conversions}>
                  <FieldLabel htmlFor="cp-conversions">转化目标</FieldLabel>
                  <Input
                    id="cp-conversions"
                    type="number"
                    min="0"
                    {...form.register("goal_conversions")}
                  />
                </Field>
                <Field data-invalid={!!form.formState.errors.goal_roi}>
                  <FieldLabel htmlFor="cp-roi">ROI 目标</FieldLabel>
                  <Input
                    id="cp-roi"
                    type="number"
                    min="0"
                    step="0.1"
                    {...form.register("goal_roi")}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="cp-goal-notes">KPI 备注</FieldLabel>
                <Textarea id="cp-goal-notes" rows={2} {...form.register("goal_notes")} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">时间线</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="cp-start">开始日期</FieldLabel>
                <Input id="cp-start" type="date" {...form.register("start_date")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cp-end">结束日期</FieldLabel>
                <Input id="cp-end" type="date" {...form.register("end_date")} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/campaigns">取消</Link>
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "创建中…" : "创建 Campaign"}
          </Button>
        </div>
      </form>
    </div>
  );
}
