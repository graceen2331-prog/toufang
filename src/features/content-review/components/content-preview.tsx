"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusTag } from "@/components/shared/status-tag";
import { CONTENT_ASSET_STATUS } from "@/shared/constants/status";
import type { ContentAssetDto } from "@/shared/schemas/content-analytics";

export function ContentPreview({ asset }: { asset: ContentAssetDto | null }) {
  if (!asset) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>内容预览</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          从左侧选择一条内容后查看正文、Brief 和审核状态。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!asset.brief_id && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Brief 缺失</AlertTitle>
          <AlertDescription>该内容还没有绑定已批准 Brief，不能发起 AI 审核。</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{asset.title ?? "未命名内容"}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {asset.creator_name} · {asset.platform ?? "未标注平台"} · {asset.content_type ?? "内容"}
              </p>
            </div>
            <StatusTag source={CONTENT_ASSET_STATUS} value={asset.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">关联 Brief</p>
            <p className="mt-1 text-sm">{asset.brief_title ?? "未绑定"}</p>
          </div>
          {asset.caption && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Caption</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{asset.caption}</p>
            </div>
          )}
          {asset.transcript && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Transcript</p>
              <p className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm leading-6">
                {asset.transcript}
              </p>
            </div>
          )}
          {asset.url && (
            <Button asChild variant="outline" size="sm">
              <a href={asset.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                打开内容链接
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
