"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/features/auth/queries";
import { ApiClientError } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";
import { LoginSchema, type LoginInput } from "@/shared/schemas/auth";
import type { DemoLoginConfig } from "@/features/auth/demo-login";

export function LoginForm({ demoConfig }: { demoConfig: DemoLoginConfig | null }) {
  const hydrated = useHydrated();
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: demoConfig?.accounts[0]?.email ?? "",
      password: demoConfig?.password ?? "",
    },
  });

  function fillDemoAccount(email: string) {
    if (!demoConfig) return;
    form.setValue("email", email, { shouldDirty: true, shouldValidate: true });
    form.setValue("password", demoConfig.password, { shouldDirty: true, shouldValidate: true });
    form.clearErrors();
  }

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onError: (err) => {
        const message = err instanceof ApiClientError ? err.message : "登录失败，请稍后再试";
        form.setError("root", { message });
      },
    });
  });

  return (
    <div className="w-full max-w-[520px]">
      <div className="mb-8">
        <p className="text-xs font-medium text-primary">工作区登录</p>
        <h2 className="mt-3 text-3xl font-semibold text-balance text-foreground sm:text-4xl">
          登录 KOL Marketing OS
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {demoConfig
            ? "使用演示账号进入工作区，体验 Campaign、审批、知识库与 AI 运行监控。"
            : "使用组织分配的账号登录工作区。若无法登录，请联系组织管理员。"}
        </p>
      </div>

      <div className="border border-foreground/10 bg-card p-5 shadow-[0_22px_70px_rgba(8,28,20,0.10)] sm:p-7">
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            <Field data-invalid={!!form.formState.errors.email}>
              <FieldLabel htmlFor="email">邮箱</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={!!form.formState.errors.email}
                className="h-11 bg-background px-3 text-sm"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <FieldError>{form.formState.errors.email.message}</FieldError>
              )}
            </Field>
            <Field data-invalid={!!form.formState.errors.password}>
              <FieldLabel htmlFor="password">密码</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                className="h-11 bg-background px-3 text-sm"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <FieldError>{form.formState.errors.password.message}</FieldError>
              )}
            </Field>
            {form.formState.errors.root && (
              <p className="text-destructive text-sm" role="alert">
                {form.formState.errors.root.message}
              </p>
            )}
            {hydrated ? (
              <Button
                type="submit"
                className="h-11 w-full text-sm"
                disabled={login.isPending}
              >
                {login.isPending ? "登录中…" : "登录"}
              </Button>
            ) : (
              <div className="h-11 w-full" aria-hidden="true" />
            )}
          </FieldGroup>
        </form>

        {demoConfig && (
          <div className="mt-7 border-t border-border pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">演示账号</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  点击账号可自动填充，密码均为 {demoConfig.password}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">可一键试用</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {demoConfig.accounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="group grid gap-1 border border-border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-accent/45 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none active:translate-y-px"
                  onClick={() => fillDemoAccount(account.email)}
                >
                  <span className="text-sm font-medium text-foreground">{account.label}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground group-hover:text-primary">
                    {account.email}
                  </span>
                  <span className="text-xs text-muted-foreground">{account.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
