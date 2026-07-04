"use client";

import Link from "next/link";
import { BarChart3, CheckSquare, FileText, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import { useAnalyticsOverview } from "@/features/analytics/queries";
import { useMe } from "@/features/auth/queries";

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: overview } = useAnalyticsOverview({});
  const totals = overview?.totals ?? {};
  const openInsightCount = overview?.insights.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">工作台</h1>
        <p className="text-sm text-muted-foreground">
          {me ? `你好，${me.user.name}。欢迎回到 ${me.org?.name ?? ""}。` : "加载中…"}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="总曝光"
          value={(totals.impressions ?? 0).toLocaleString("zh-CN")}
          hint="来自 performance_metrics"
          icon={<BarChart3 className="size-4 text-muted-foreground" />}
        />
        <MetricCard
          label="总观看"
          value={(totals.views ?? 0).toLocaleString("zh-CN")}
          hint="按当前组织汇总"
          icon={<BarChart3 className="size-4 text-muted-foreground" />}
        />
        <MetricCard
          label="打开洞察"
          value={openInsightCount}
          hint="需要运营跟进"
          icon={<FileText className="size-4 text-muted-foreground" />}
        />
        <MetricCard
          label="转化"
          value={(totals.conversions ?? 0).toLocaleString("zh-CN")}
          hint="缺数据时保持 0"
          icon={<CheckSquare className="size-4 text-muted-foreground" />}
        />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" />
              数据分析
            </CardTitle>
            <CardDescription>查看 KPI 趋势、内容排名、AI 洞察与数据质量提示。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/analytics" className="text-sm font-medium text-primary hover:underline">
              查看分析 →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="size-4 text-primary" />
              内容审核
            </CardTitle>
            <CardDescription>处理达人内容初稿、AI 风险 findings 与人工复核。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/content-review" className="text-sm font-medium text-primary hover:underline">
              进入审核 →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
