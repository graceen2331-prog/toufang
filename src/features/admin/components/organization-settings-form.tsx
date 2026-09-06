"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/features/admin/queries";
import type { OrganizationSettingsDto } from "@/shared/schemas/admin";

export function OrganizationSettingsForm() {
  const query = useOrganizationSettings();

  return (
    <AsyncBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => query.refetch()}
    >
      {query.data && <OrganizationSettingsFormBody data={query.data} />}
    </AsyncBoundary>
  );
}

function OrganizationSettingsFormBody({ data }: { data: OrganizationSettingsDto }) {
  const update = useUpdateOrganizationSettings();
  const [name, setName] = useState(() => data.name);
  const [notes, setNotes] = useState(() => String(data.settings.notes ?? ""));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">组织基础设置</CardTitle>
      </CardHeader>
      <CardContent className="max-w-2xl space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="org-name">
            组织名称
          </label>
          <Input id="org-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="org-slug">
            组织标识
          </label>
          <Input id="org-slug" value={data.slug} disabled />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="org-notes">
            内部备注
          </label>
          <Textarea
            id="org-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={5}
          />
        </div>
        <Button
          disabled={update.isPending || !name.trim()}
          onClick={() => update.mutate({ name, settings: { ...data.settings, notes } })}
        >
          <Save className="size-4" />
          保存设置
        </Button>
      </CardContent>
    </Card>
  );
}
