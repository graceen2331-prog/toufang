"use client";

import { use } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AsyncBoundary, DetailSkeleton } from "@/components/shared/async-boundary";
import { StatusTag } from "@/components/shared/status-tag";
import { CampaignActionRail } from "@/features/campaigns/components/campaign-action-rail";
import { CampaignCreatorsTab } from "@/features/campaigns/components/campaign-creators-tab";
import { CampaignOverviewTab } from "@/features/campaigns/components/campaign-overview-tab";
import { CampaignStageFlow } from "@/features/campaigns/components/campaign-stage-flow";
import { CampaignWorkspaceTab } from "@/features/campaigns/components/campaign-workspace-tab";
import { PipelineTab } from "@/features/campaigns/components/pipeline-tab";
import { StrategyTab } from "@/features/campaigns/components/strategy-tab";
import { BriefTab } from "@/features/briefs/components/brief-tab";
import { useCampaign } from "@/features/campaigns/queries";
import { CAMPAIGN_STATUS } from "@/shared/constants/status";
import type { CampaignDetailDto } from "@/shared/schemas/campaign";

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: campaign, isLoading, isError, error, refetch } = useCampaign(id);

  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<DetailSkeleton />}
    >
      {campaign && (
        <div className="space-y-6">
          <CampaignHeader campaign={campaign} />
          <CampaignStageFlow campaignId={campaign.id} currentStatus={campaign.status} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Tabs defaultValue="overview" className="min-w-0 xl:order-1">
              <div className="overflow-x-auto border-b pb-1">
                <TabsList variant="line" className="min-w-max justify-start">
                  <TabsTrigger value="overview">概览</TabsTrigger>
                  <TabsTrigger value="strategy">策略</TabsTrigger>
                  <TabsTrigger value="pipeline">达人 Pipeline</TabsTrigger>
                  <TabsTrigger value="brief">Brief</TabsTrigger>
                  <TabsTrigger value="outreach">Outreach</TabsTrigger>
                  <TabsTrigger value="content">内容</TabsTrigger>
                  <TabsTrigger value="contracts">合同付款</TabsTrigger>
                  <TabsTrigger value="analytics">数据</TabsTrigger>
                  <TabsTrigger value="reports">报告</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-4">
                <CampaignOverviewTab campaign={campaign} />
              </TabsContent>
              <TabsContent value="strategy" className="mt-4">
                <StrategyTab campaignId={campaign.id} />
              </TabsContent>
              <TabsContent value="pipeline" className="mt-4">
                <div className="space-y-4">
                  <PipelineTab campaignId={campaign.id} campaignName={campaign.name} />
                  <CampaignCreatorsTab campaignId={campaign.id} />
                </div>
              </TabsContent>
              <TabsContent value="brief" className="mt-4">
                <BriefTab campaignId={campaign.id} />
              </TabsContent>
              <TabsContent value="outreach" className="mt-4">
                <CampaignWorkspaceTab campaignId={campaign.id} kind="outreach" />
              </TabsContent>
              <TabsContent value="content" className="mt-4">
                <CampaignWorkspaceTab campaignId={campaign.id} kind="content" />
              </TabsContent>
              <TabsContent value="contracts" className="mt-4">
                <CampaignWorkspaceTab campaignId={campaign.id} kind="contracts" />
              </TabsContent>
              <TabsContent value="analytics" className="mt-4">
                <CampaignWorkspaceTab campaignId={campaign.id} kind="analytics" />
              </TabsContent>
              <TabsContent value="reports" className="mt-4">
                <CampaignWorkspaceTab campaignId={campaign.id} kind="reports" />
              </TabsContent>
            </Tabs>

            <div className="xl:order-2">
              <CampaignActionRail campaignId={campaign.id} campaignStatus={campaign.status} />
            </div>
          </div>
        </div>
      )}
    </AsyncBoundary>
  );
}

function CampaignHeader({ campaign }: { campaign: CampaignDetailDto }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">Campaigns / {campaign.name}</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground">
          {campaign.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {campaign.brand_name}
          {campaign.product_name ? ` · ${campaign.product_name}` : ""}
          {campaign.owner_name ? ` · 负责人 ${campaign.owner_name}` : ""}
        </p>
      </div>
      <StatusTag source={CAMPAIGN_STATUS} value={campaign.status} />
    </div>
  );
}
