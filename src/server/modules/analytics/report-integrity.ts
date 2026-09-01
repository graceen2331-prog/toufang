import "server-only";
import { createHash } from "node:crypto";

export const REPORT_HASH_ALGORITHM = "sha256-canonical-json-v1";

export interface ReportSnapshotSource {
  id: string;
  seriesId: string;
  version: number;
  campaignId: string | null;
  title: string;
  kind: string;
  content: unknown;
  aiGenerated: boolean;
  agentRunId: string | null;
  promptKey: string | null;
  promptVersion: string | null;
  model: string | null;
}

export interface ReportSnapshot {
  report_id: string;
  series_id: string;
  version: number;
  campaign_id: string | null;
  title: string;
  kind: string;
  content: unknown;
  ai_provenance: {
    ai_generated: boolean;
    agent_run_id: string | null;
    prompt_key: string | null;
    prompt_version: string | null;
    model: string | null;
  };
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("报告快照包含非有限数字");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  throw new Error(`报告快照包含不支持的值：${typeof value}`);
}

export function buildReportSnapshot(report: ReportSnapshotSource): ReportSnapshot {
  return {
    report_id: report.id,
    series_id: report.seriesId,
    version: report.version,
    campaign_id: report.campaignId,
    title: report.title,
    kind: report.kind,
    content: report.content,
    ai_provenance: {
      ai_generated: report.aiGenerated,
      agent_run_id: report.agentRunId,
      prompt_key: report.promptKey,
      prompt_version: report.promptVersion,
      model: report.model,
    },
  };
}

export function hashReportSnapshot(snapshot: ReportSnapshot): string {
  const serialized = JSON.stringify(canonicalize(snapshot));
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}
