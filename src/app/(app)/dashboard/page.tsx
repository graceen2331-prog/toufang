"use client";

import Link from "next/link";
import { Package, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/features/auth/queries";

export default function DashboardPage() {
  const { data: me } = useMe();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">工作台</h1>
        <p className="text-sm text-muted-foreground">
          {me ? `你好，${me.user.name}。欢迎回到 ${me.org?.name ?? ""}。` : "加载中…"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4 text-primary" />
              品牌与产品
            </CardTitle>
            <CardDescription>维护品牌规范与产品资料，它们是 AI 策略与 Brief 的基础输入。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/brands" className="text-sm font-medium text-primary hover:underline">
              进入管理 →
            </Link>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-muted-foreground" />
              更多模块建设中
            </CardTitle>
            <CardDescription>
              达人库、Campaign、AI 工作流、审批中心等模块将按里程碑逐步开放。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
