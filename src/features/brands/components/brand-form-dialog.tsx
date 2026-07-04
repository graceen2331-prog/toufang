"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBrand, useUpdateBrand } from "@/features/brands/queries";
import type { BrandDto } from "@/shared/schemas/brand";

// 表单内部 schema：数组字段用逗号分隔文本编辑
const FormSchema = z.object({
  name: z.string().min(1, "请输入品牌名称").max(100),
  slug: z
    .string()
    .min(1, "请输入品牌标识")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "只能包含小写字母、数字和连字符"),
  description: z.string().max(2000).optional(),
  industry: z.string().max(100).optional(),
  markets: z.string().optional(),
  tone: z.string().optional(),
  restricted_terms: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function BrandFormDialog({
  open,
  onOpenChange,
  brand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 传入 = 编辑模式 */
  brand?: BrandDto | null;
}) {
  const create = useCreateBrand();
  const update = useUpdateBrand();
  const isEdit = !!brand;
  const pending = create.isPending || update.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: "", slug: "", description: "", industry: "", markets: "", tone: "", restricted_terms: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: brand?.name ?? "",
        slug: brand?.slug ?? "",
        description: brand?.description ?? "",
        industry: brand?.industry ?? "",
        markets: brand?.markets.join("，") ?? "",
        tone: brand?.guidelines?.tone ?? "",
        restricted_terms: brand?.restricted_terms.join("，") ?? "",
      });
    }
  }, [open, brand, form]);

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      name: values.name,
      description: values.description || null,
      industry: values.industry || null,
      markets: splitList(values.markets),
      guidelines: values.tone ? { tone: values.tone } : {},
      restricted_terms: splitList(values.restricted_terms),
    };
    const onSuccess = () => onOpenChange(false);
    if (isEdit && brand) {
      update.mutate({ id: brand.id, input: payload }, { onSuccess });
    } else {
      create.mutate({ ...payload, slug: values.slug }, { onSuccess });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑品牌" : "新建品牌"}</DialogTitle>
          <DialogDescription>品牌规范与禁用词会作为 AI 生成策略、Brief 的约束输入。</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="brand-name">品牌名称</FieldLabel>
                <Input id="brand-name" placeholder="如：光泽实验室" {...form.register("name")} />
                {form.formState.errors.name && (
                  <FieldError>{form.formState.errors.name.message}</FieldError>
                )}
              </Field>
              <Field data-invalid={!!form.formState.errors.slug}>
                <FieldLabel htmlFor="brand-slug">品牌标识</FieldLabel>
                <Input
                  id="brand-slug"
                  placeholder="如：glowlab"
                  disabled={isEdit}
                  {...form.register("slug")}
                />
                {form.formState.errors.slug && (
                  <FieldError>{form.formState.errors.slug.message}</FieldError>
                )}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="brand-industry">行业</FieldLabel>
              <Input id="brand-industry" placeholder="如：美妆个护" {...form.register("industry")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="brand-desc">品牌简介</FieldLabel>
              <Textarea id="brand-desc" rows={2} {...form.register("description")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="brand-markets">目标市场</FieldLabel>
              <Input id="brand-markets" placeholder="逗号分隔，如：中国大陆，东南亚" {...form.register("markets")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="brand-tone">品牌语气</FieldLabel>
              <Input id="brand-tone" placeholder="如：专业而亲和，避免夸张促销感" {...form.register("tone")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="brand-restricted">禁用词</FieldLabel>
              <Input id="brand-restricted" placeholder="逗号分隔，如：最强，第一，治愈" {...form.register("restricted_terms")} />
              <FieldDescription>内容审核与 AI 生成会强制规避这些表达</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
