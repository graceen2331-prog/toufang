"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BrandLeadFilters } from "@/features/brand-leads/queries";

const ALL = "__all__";

const COUNTRIES = ["United States", "China", "South Korea", "France", "Taiwan", "Turkey"];
const CATEGORIES = [
  "Artificial Intelligence",
  "Robotics",
  "Digital Health",
  "Smart Home & Appliances",
  "Vehicle Tech & Advanced Mobility",
  "IoT/Sensors",
  "Accessories",
];

export function BrandLeadFiltersBar({
  filters,
  onChange,
}: {
  filters: BrandLeadFilters;
  onChange: (filters: BrandLeadFilters) => void;
}) {
  const hasFilters = Boolean(
    filters.q || filters.country || filters.category || filters.tier || filters.seeking_funding,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-none border bg-card p-3">
      <div className="relative min-w-60 flex-1">
        <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="搜索品牌、官网或描述"
          className="pl-8"
          value={filters.q ?? ""}
          onChange={(event) => onChange({ ...filters, q: event.target.value, cursor: null })}
        />
      </div>
      <Select
        value={filters.tier ?? ALL}
        onValueChange={(value) =>
          onChange({ ...filters, tier: value === ALL ? undefined : value, cursor: null })
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="机会层级" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>全部层级</SelectItem>
          <SelectItem value="priority">优先跟进</SelectItem>
          <SelectItem value="nurture">培育观察</SelectItem>
          <SelectItem value="watch">保持关注</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.country ?? ALL}
        onValueChange={(value) =>
          onChange({ ...filters, country: value === ALL ? undefined : value, cursor: null })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="国家/地区" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>全部地区</SelectItem>
          {COUNTRIES.map((country) => (
            <SelectItem key={country} value={country}>
              {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.category ?? ALL}
        onValueChange={(value) =>
          onChange({ ...filters, category: value === ALL ? undefined : value, cursor: null })
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="品类" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>全部品类</SelectItem>
          {CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={filters.seeking_funding ? "default" : "outline"}
        onClick={() =>
          onChange({ ...filters, seeking_funding: filters.seeking_funding ? undefined : true, cursor: null })
        }
      >
        融资需求
      </Button>
      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={() => onChange({ cursor: null })} aria-label="清除筛选">
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
