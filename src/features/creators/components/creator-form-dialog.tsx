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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCreator, useUpdateCreator } from "@/features/creators/queries";
import type { CreatorDetailDto } from "@/shared/schemas/creator";

const FormSchema = z.object({
  display_name: z.string().min(1, "请输入达人名称").max(100),
  bio: z.string().max(2000).optional(),
  country: z.string().max(50).optional(),
  categories: z.string().optional(),
  tags: z.string().optional(),
  contact_email: z.string().optional(),
  contact_wechat: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CreatorFormDialog({
  open,
  onOpenChange,
  creator,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator?: CreatorDetailDto | null;
}) {
  const create = useCreateCreator();
  const update = useUpdateCreator();
  const isEdit = !!creator;
  const pending = create.isPending || update.isPending;

  const form = useForm<FormValues>({ resolver: zodResolver(FormSchema) });

  useEffect(() => {
    if (open) {
      form.reset({
        display_name: creator?.display_name ?? "",
        bio: creator?.bio ?? "",
        country: creator?.country ?? "",
        categories: creator?.categories.join("，") ?? "",
        tags: creator?.tags.join("，") ?? "",
        contact_email: "",
        contact_wechat: "",
      });
    }
  }, [open, creator, form]);

  const onSubmit = form.handleSubmit((values) => {
    const contact = {
      ...(values.contact_email ? { email: values.contact_email } : {}),
      ...(values.contact_wechat ? { wechat: values.contact_wechat } : {}),
    };
    const payload = {
      display_name: values.display_name,
      bio: values.bio || null,
      country: values.country || null,
      languages: [],
      categories: splitList(values.categories),
      tags: splitList(values.tags),
    };
    const onSuccess = () => onOpenChange(false);
    if (isEdit && creator) {
      // 编辑时不覆盖联系方式（联系方式单独管理，避免误清空）
      update.mutate({ id: creator.id, input: payload }, { onSuccess });
    } else {
      create.mutate({ ...payload, contact_info: contact }, { onSuccess });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑达人" : "新建达人"}</DialogTitle>
          <DialogDescription>
            创建后可在详情页添加平台账号、笔记与联系方式。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!form.formState.errors.display_name}>
                <FieldLabel htmlFor="c-name">达人名称</FieldLabel>
                <Input id="c-name" placeholder="如：美妆小鹿" {...form.register("display_name")} />
                {form.formState.errors.display_name && (
                  <FieldError>{form.formState.errors.display_name.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="c-country">国家/地区</FieldLabel>
                <Input id="c-country" placeholder="如：中国大陆" {...form.register("country")} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="c-bio">简介</FieldLabel>
              <Textarea id="c-bio" rows={2} {...form.register("bio")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="c-categories">内容分类</FieldLabel>
              <Input id="c-categories" placeholder="逗号分隔，如：美妆，护肤测评" {...form.register("categories")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="c-tags">标签</FieldLabel>
              <Input id="c-tags" placeholder="逗号分隔，如：成分党，高互动" {...form.register("tags")} />
            </Field>
            {!isEdit && (
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="c-email">邮箱（可选）</FieldLabel>
                  <Input id="c-email" {...form.register("contact_email")} />
                  <FieldDescription>联系方式将加密存储</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="c-wechat">微信（可选）</FieldLabel>
                  <Input id="c-wechat" {...form.register("contact_wechat")} />
                </Field>
              </div>
            )}
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
