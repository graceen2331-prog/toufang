"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BRAND_LEAD_TIER_LABELS,
  BRAND_LEAD_TIER_TONES,
  type BrandLeadDto,
} from "@/shared/schemas/brand-lead";
import { normalizeExternalUrl } from "@/shared/url";

export function BrandLeadTable({
  leads,
  onSelect,
}: {
  leads: BrandLeadDto[];
  onSelect: (lead: BrandLeadDto) => void;
}) {
  return (
    <div className="rounded-none border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>品牌线索</TableHead>
            <TableHead>品类</TableHead>
            <TableHead>国家/地区</TableHead>
            <TableHead>融资</TableHead>
            <TableHead className="text-right">机会分</TableHead>
            <TableHead className="w-24 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const websiteUrl = normalizeExternalUrl(lead.website);
            return (
              <TableRow key={lead.id}>
                <TableCell className="max-w-80">
                  <button
                    type="button"
                    className="block text-left font-medium hover:underline"
                    onClick={() => onSelect(lead)}
                  >
                    {lead.name_zh ?? lead.name}
                  </button>
                  {lead.name_zh && lead.name_zh !== lead.name && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{lead.name}</div>
                  )}
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {lead.brand_profile_zh ?? lead.description ?? lead.website ?? "暂无描述"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-72 flex-wrap gap-1">
                    {lead.product_categories.slice(0, 3).map((category) => (
                      <Badge key={category} variant="secondary">
                        {category}
                      </Badge>
                    ))}
                    {lead.product_categories.length > 3 && (
                      <Badge variant="outline">+{lead.product_categories.length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{lead.country ?? "—"}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div>{lead.seek_funding ?? "—"}</div>
                    {lead.investment_stage && (
                      <div className="text-xs text-muted-foreground">{lead.investment_stage}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-medium tabular-nums">{lead.opportunity_score}</div>
                  <Badge
                    variant={lead.opportunity_tier === "priority" ? "default" : "outline"}
                    className={
                      BRAND_LEAD_TIER_TONES[lead.opportunity_tier] === "success"
                        ? "mt-1 border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "mt-1"
                    }
                  >
                    {BRAND_LEAD_TIER_LABELS[lead.opportunity_tier]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {websiteUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label={`打开 ${lead.name} 官网`}
                      >
                        <a href={websiteUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => onSelect(lead)}>
                      详情
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
