"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGENT_RUN_STATUS } from "@/shared/constants/status";
import {
  AGENT_ANOMALY_LABELS,
  AGENT_KEY_LABELS,
} from "@/shared/schemas/agent-monitor";

interface AgentRunFilterValues {
  status: string;
  agent_key: string;
  provider: string;
  mode: string;
  anomaly: string;
  date_from: string;
  date_to: string;
}

export function AgentRunFilters({
  filters,
  isFiltered,
  onChange,
  onReset,
}: {
  filters: AgentRunFilterValues;
  isFiltered: boolean;
  onChange: (key: keyof AgentRunFilterValues, value: string) => void;
  onReset: () => void;
}) {
  return (
    <section aria-label="运行筛选" className="flex flex-wrap items-end gap-2 rounded-lg border bg-card/70 p-3">
      <FilterSelect
        label="状态"
        value={filters.status}
        onChange={(value) => onChange("status", value)}
        options={Object.entries(AGENT_RUN_STATUS).map(([value, meta]) => ({ value, label: meta.label }))}
      />
      <FilterSelect
        label="Agent"
        value={filters.agent_key}
        onChange={(value) => onChange("agent_key", value)}
        options={Object.entries(AGENT_KEY_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <FilterSelect
        label="运行方式"
        value={filters.mode}
        onChange={(value) => onChange("mode", value)}
        options={[
          { value: "workflow", label: "工作流" },
          { value: "sync", label: "同步调用" },
        ]}
      />
      <FilterSelect
        label="异常"
        value={filters.anomaly}
        onChange={(value) => onChange("anomaly", value)}
        options={Object.entries(AGENT_ANOMALY_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <FilterSelect
        label="Provider"
        value={filters.provider}
        onChange={(value) => onChange("provider", value)}
        options={[
          { value: "openai", label: "OpenAI / 兼容接口" },
          { value: "fake", label: "Fake（测试）" },
          { value: "anthropic", label: "Anthropic" },
          { value: "gemini", label: "Gemini" },
        ]}
      />
      <label className="grid gap-1 text-xs text-muted-foreground">
        开始日期
        <Input
          type="date"
          value={filters.date_from}
          onChange={(event) => onChange("date_from", event.target.value)}
          className="h-8 w-36 text-xs"
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        结束日期
        <Input
          type="date"
          value={filters.date_to}
          onChange={(event) => onChange("date_to", event.target.value)}
          className="h-8 w-36 text-xs"
        />
      </label>
      {isFiltered && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          清除筛选
        </Button>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <Select value={value || "all"} onValueChange={(next) => onChange(next === "all" ? "" : next)}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
