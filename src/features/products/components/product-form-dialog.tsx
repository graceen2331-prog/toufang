"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
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
import { useCreateProduct, useUpdateProduct } from "@/features/products/queries";
import type { BrandDto } from "@/shared/schemas/brand";
import type { ProductDto } from "@/shared/schemas/product";

const FormSchema = z.object({
  brand_id: z.string().min(1, "请选择品牌"),
  name: z.string().min(1, "请输入产品名称").max(100),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  price_amount: z.string().optional(),
  key_claims: z.string().optional(),
  restricted_claims: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  brands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductDto | null;
  brands: BrandDto[];
}) {
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const isEdit = !!product;
  const pending = create.isPending || update.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      brand_id: "",
      name: "",
      description: "",
      category: "",
      price_amount: "",
      key_claims: "",
      restricted_claims: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        brand_id: product?.brand_id ?? brands[0]?.id ?? "",
        name: product?.name ?? "",
        description: product?.description ?? "",
        category: product?.category ?? "",
        price_amount: product?.price?.amount != null ? String(product.price.amount) : "",
        key_claims: product?.key_claims.join("，") ?? "",
        restricted_claims: product?.restricted_claims.join("，") ?? "",
      });
    }
  }, [open, product, brands, form]);

  const brandId = useWatch({ control: form.control, name: "brand_id" });

  const onSubmit = form.handleSubmit((values) => {
    const amount = values.price_amount ? Number(values.price_amount) : undefined;
    const payload = {
      name: values.name,
      description: values.description || null,
      category: values.category || null,
      price: amount !== undefined && !Number.isNaN(amount) ? { amount, currency: "CNY" } : {},
      key_claims: splitList(values.key_claims),
      restricted_claims: splitList(values.restricted_claims),
      links: [],
    };
    const onSuccess = () => onOpenChange(false);
    if (isEdit && product) {
      update.mutate({ id: product.id, input: payload }, { onSuccess });
    } else {
      create.mutate({ ...payload, brand_id: values.brand_id }, { onSuccess });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑产品" : "新建产品"}</DialogTitle>
          <DialogDescription>核心卖点与禁止声明将约束 Brief 与内容审核。</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!form.formState.errors.brand_id}>
                <FieldLabel>所属品牌</FieldLabel>
                <Select
                  value={brandId}
                  onValueChange={(v) => form.setValue("brand_id", v, { shouldValidate: true })}
                  disabled={isEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
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
              <Field data-invalid={!!form.formState.errors.name}>
                <FieldLabel htmlFor="product-name">产品名称</FieldLabel>
                <Input id="product-name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <FieldError>{form.formState.errors.name.message}</FieldError>
                )}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="product-category">品类</FieldLabel>
                <Input id="product-category" placeholder="如：精华液" {...form.register("category")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="product-price">售价（元）</FieldLabel>
                <Input id="product-price" type="number" min="0" {...form.register("price_amount")} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="product-desc">产品说明</FieldLabel>
              <Textarea id="product-desc" rows={2} {...form.register("description")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="product-claims">核心卖点</FieldLabel>
              <Input id="product-claims" placeholder="逗号分隔" {...form.register("key_claims")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="product-restricted">禁止声明</FieldLabel>
              <Input id="product-restricted" placeholder="逗号分隔，如：医疗功效" {...form.register("restricted_claims")} />
              <FieldDescription>法务/合规要求不允许出现的产品声明</FieldDescription>
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
