"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateUserSettings, useUserSettings } from "@/features/settings/queries";
import type { UserSettingsDto } from "@/shared/schemas/settings";

export function SettingsForm() {
  const query = useUserSettings();

  return (
    <AsyncBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => query.refetch()}
    >
      {query.data && <SettingsFormBody data={query.data} />}
    </AsyncBoundary>
  );
}

function SettingsFormBody({ data }: { data: UserSettingsDto }) {
  const update = useUpdateUserSettings();
  const [name, setName] = useState(() => data.user.name);
  const [locale, setLocale] = useState(() => data.user.locale);
  const [notifyApprovals, setNotifyApprovals] = useState(() =>
    Boolean(data.user.settings.notify_approvals ?? true),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">个人资料</CardTitle>
        </CardHeader>
        <CardContent className="max-w-2xl space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="settings-name">
              姓名
            </label>
            <Input
              id="settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="settings-email">
              邮箱
            </label>
            <Input id="settings-email" value={data.user.email} disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">语言</label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">简体中文</SelectItem>
                <SelectItem value="en-US">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={notifyApprovals}
              onCheckedChange={(value) => setNotifyApprovals(Boolean(value))}
            />
            接收审批和工作流通知
          </label>
          <Button
            disabled={update.isPending || !name.trim()}
            onClick={() =>
              update.mutate({
                name,
                locale,
                settings: { notify_approvals: notifyApprovals },
              })
            }
          >
            <Save className="size-4" />
            保存设置
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">当前组织</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">名称</span>
            <span className="font-medium">{data.org.name}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">标识</span>
            <span className="font-medium">{data.org.slug}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
