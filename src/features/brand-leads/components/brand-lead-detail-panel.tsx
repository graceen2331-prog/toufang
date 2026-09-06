"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Lightbulb, MapPin, Send, UserRoundSearch } from "lucide-react";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { BrandLeadDto } from "@/shared/schemas/brand-lead";
import { normalizeExternalUrl } from "@/shared/url";
import { BrandLeadConvertDialog } from "./brand-lead-convert-dialog";

export function BrandLeadDetailPanel({
  lead,
  open,
  onOpenChange,
}: {
  lead: BrandLeadDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const websiteUrl = normalizeExternalUrl(lead?.website);
  const [convertOpen, setConvertOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {lead && (
            <>
              <SheetHeader>
                <SheetTitle>{lead.name_zh ?? lead.name}</SheetTitle>
                <SheetDescription>
                  {lead.name_zh && lead.name_zh !== lead.name ? `${lead.name} · ` : ""}
                  {lead.country ?? "未知地区"} · 机会分 {lead.opportunity_score}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-6">
                <div className="flex flex-wrap gap-2">
                  {lead.product_categories.map((category) => (
                    <Badge key={category} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>

                <Section title="品牌画像">
                  <p>{lead.brand_profile_zh ?? lead.description ?? "暂无描述"}</p>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <Info
                      icon={<MapPin className="size-3.5" />}
                      label="展位"
                      value={lead.booth_full ?? "—"}
                    />
                    <Info label="融资" value={lead.seek_funding ?? "—"} />
                    <Info label="融资额" value={lead.funding_amount ?? "—"} />
                    <Info label="阶段" value={lead.investment_stage ?? "—"} />
                    <Info label="营收" value={lead.revenue ?? "—"} />
                  </div>
                </Section>

                <Separator />

                <Section title="推荐达人画像" icon={<UserRoundSearch className="size-4" />}>
                  <p>{lead.recommended_creator_profile ?? "科技测评达人、展会探访型创作者"}</p>
                </Section>

                <Section title="Campaign 角度" icon={<Lightbulb className="size-4" />}>
                  <div className="flex flex-wrap gap-2">
                    {lead.campaign_angles.map((angle) => (
                      <Badge key={angle} variant="outline">
                        {angle}
                      </Badge>
                    ))}
                  </div>
                </Section>

                <Section title="外联信号" icon={<Send className="size-4" />}>
                  {lead.outreach_signals.length > 0 ? (
                    <ul className="list-inside list-disc space-y-1">
                      {lead.outreach_signals.map((signal) => (
                        <li key={signal}>{signal}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">暂无明显信号，建议先做品牌研究。</p>
                  )}
                </Section>

                {websiteUrl && (
                  <Button asChild variant="outline" className="w-full">
                    <a href={websiteUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      打开官网
                    </a>
                  </Button>
                )}

                {lead.converted_campaign_id ? (
                  <Button asChild className="w-full">
                    <Link href={`/campaigns/${lead.converted_campaign_id}`}>
                      查看已创建 Campaign
                    </Link>
                  </Button>
                ) : (
                  <PermissionGate permission="brand:write">
                    <PermissionGate permission="campaign:write">
                      <Button className="w-full" onClick={() => setConvertOpen(true)}>
                        发起 Campaign
                      </Button>
                    </PermissionGate>
                  </PermissionGate>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {lead && convertOpen && (
        <BrandLeadConvertDialog
          key={lead.id}
          lead={lead}
          open={convertOpen}
          onOpenChange={setConvertOpen}
        />
      )}
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </h2>
      <div className="text-sm leading-6">{children}</div>
    </section>
  );
}

function Info({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}
