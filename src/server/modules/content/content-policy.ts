import { createHash } from "node:crypto";
import type { ContentReviewOutput } from "@/server/ai/prompts/content-review";

export const CONTENT_POLICY_VERSION = "content-policy-v1";

export type ContentFindingOrigin = "deterministic" | "ai";
export type ContentFindingSource = "brand" | "brief" | "platform" | "system" | "ai";

export interface EffectiveContentFinding {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  quote: string | null;
  issue: string;
  suggestion: string;
  origin: ContentFindingOrigin;
  source: ContentFindingSource;
  rule_id: string;
  rule_version: string;
  blocking: boolean;
  field: "caption" | "transcript" | "combined";
}

interface StructuredComplianceRules {
  requiredTerms: string[];
  prohibitedTerms: string[];
  requiredHashtags: string[];
  maxCaptionLength: number | null;
}

export interface DeterministicContentEvaluation {
  inputHash: string;
  ruleSetVersion: string;
  findings: EffectiveContentFinding[];
  summary: {
    blockingFindingIds: string[];
    structuredRules: StructuredComplianceRules;
    policyVersion: string;
  };
}

export interface EffectiveContentReview extends ContentReviewOutput {
  findings: EffectiveContentFinding[];
  normalization_notes: string[];
  input_hash: string;
  rule_set_version: string;
  deterministic_summary: DeterministicContentEvaluation["summary"];
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizePolicyText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/gu, " ").trim();
}

export function hashContentInput(input: {
  platform: string | null;
  caption: string | null;
  transcript: string | null;
  url?: string | null;
}): string {
  return digest({
    platform: normalizePolicyText(input.platform ?? ""),
    caption: normalizePolicyText(input.caption ?? ""),
    transcript: normalizePolicyText(input.transcript ?? ""),
    url: input.url?.trim() ?? null,
  });
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractComplianceRules(briefContent: unknown): StructuredComplianceRules {
  const brief = record(briefContent);
  const compliance = record(brief?.compliance);
  const maxCaptionLengthValue = compliance?.maxCaptionLength ?? compliance?.max_caption_length;
  return {
    requiredTerms: stringArray(compliance?.requiredTerms ?? compliance?.required_terms),
    prohibitedTerms: stringArray(compliance?.prohibitedTerms ?? compliance?.prohibited_terms),
    requiredHashtags: stringArray(compliance?.requiredHashtags ?? compliance?.required_hashtags),
    maxCaptionLength:
      typeof maxCaptionLengthValue === "number" &&
      Number.isInteger(maxCaptionLengthValue) &&
      maxCaptionLengthValue > 0
        ? maxCaptionLengthValue
        : null,
  };
}

function restrictedTermStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const terms = value.flatMap((item) => {
    if (typeof item === "string") return [item];
    const row = record(item);
    return typeof row?.term === "string" ? [row.term] : [];
  });
  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
}

function findingId(ruleId: string, field: string, match: string): string {
  return `finding_${digest([ruleId, field, normalizePolicyText(match)]).slice(0, 20)}`;
}

function literalFindings(input: {
  terms: string[];
  rulePrefix: string;
  source: "brand" | "brief";
  type: string;
  caption: string;
  transcript: string;
  issue: (term: string) => string;
  suggestion: string;
}): EffectiveContentFinding[] {
  const fields = [
    ["caption", input.caption],
    ["transcript", input.transcript],
  ] as const;
  const results: EffectiveContentFinding[] = [];
  for (const term of input.terms) {
    const normalizedTerm = normalizePolicyText(term);
    if (!normalizedTerm) continue;
    for (const [field, text] of fields) {
      if (!normalizePolicyText(text).includes(normalizedTerm)) continue;
      const ruleId = `${input.rulePrefix}:${digest(normalizedTerm).slice(0, 12)}`;
      results.push({
        id: findingId(ruleId, field, term),
        type: input.type,
        severity: "high",
        quote: term,
        issue: input.issue(term),
        suggestion: input.suggestion,
        origin: "deterministic",
        source: input.source,
        rule_id: ruleId,
        rule_version: CONTENT_POLICY_VERSION,
        blocking: true,
        field,
      });
    }
  }
  return results;
}

export function evaluateDeterministicContent(input: {
  platform: string | null;
  caption: string | null;
  transcript: string | null;
  url?: string | null;
  brandRestrictedTerms: unknown;
  briefContent: unknown;
}): DeterministicContentEvaluation {
  const caption = input.caption ?? "";
  const transcript = input.transcript ?? "";
  const structuredRules = extractComplianceRules(input.briefContent);
  const restrictedTerms = restrictedTermStrings(input.brandRestrictedTerms);
  const findings: EffectiveContentFinding[] = [];

  if (!normalizePolicyText(caption) && !normalizePolicyText(transcript)) {
    findings.push({
      id: findingId("system:content_required", "combined", "empty"),
      type: "content_required",
      severity: "high",
      quote: null,
      issue: "标题文案与口播稿同时为空，缺少可审核的发布正文。",
      suggestion: "请补充实际发布文案或口播稿后重新提交审核。",
      origin: "deterministic",
      source: "system",
      rule_id: "system:content_required",
      rule_version: CONTENT_POLICY_VERSION,
      blocking: true,
      field: "combined",
    });
  }

  findings.push(
    ...literalFindings({
      terms: restrictedTerms,
      rulePrefix: "brand:restricted_term",
      source: "brand",
      type: "restricted_term",
      caption,
      transcript,
      issue: (term) => `命中品牌禁用词“${term}”。`,
      suggestion: "删除或改写该表达，并按品牌规范重新提交审核。",
    }),
    ...literalFindings({
      terms: structuredRules.prohibitedTerms,
      rulePrefix: "brief:prohibited_term",
      source: "brief",
      type: "brief_prohibited_term",
      caption,
      transcript,
      issue: (term) => `命中 Brief 明确禁止的表达“${term}”。`,
      suggestion: "按 Brief 要求删除或改写该表达。",
    }),
  );

  const combined = normalizePolicyText(`${caption}\n${transcript}`);
  for (const term of structuredRules.requiredTerms) {
    if (combined.includes(normalizePolicyText(term))) continue;
    const ruleId = `brief:required_term:${digest(normalizePolicyText(term)).slice(0, 12)}`;
    findings.push({
      id: findingId(ruleId, "combined", term),
      type: "brief_required_term",
      severity: "high",
      quote: null,
      issue: `缺少 Brief 明确要求的表达“${term}”。`,
      suggestion: `在发布正文中补充“${term}”或由内容负责人更新结构化 Brief 规则。`,
      origin: "deterministic",
      source: "brief",
      rule_id: ruleId,
      rule_version: CONTENT_POLICY_VERSION,
      blocking: true,
      field: "combined",
    });
  }

  const normalizedCaption = normalizePolicyText(caption);
  for (const hashtag of structuredRules.requiredHashtags) {
    if (normalizedCaption.includes(normalizePolicyText(hashtag))) continue;
    const ruleId = `brief:required_hashtag:${digest(normalizePolicyText(hashtag)).slice(0, 12)}`;
    findings.push({
      id: findingId(ruleId, "caption", hashtag),
      type: "brief_required_hashtag",
      severity: "high",
      quote: null,
      issue: `标题文案缺少 Brief 要求的话题“${hashtag}”。`,
      suggestion: `在标题文案中补充“${hashtag}”。`,
      origin: "deterministic",
      source: "brief",
      rule_id: ruleId,
      rule_version: CONTENT_POLICY_VERSION,
      blocking: true,
      field: "caption",
    });
  }

  if (structuredRules.maxCaptionLength && [...caption].length > structuredRules.maxCaptionLength) {
    const ruleId = "brief:max_caption_length";
    findings.push({
      id: findingId(ruleId, "caption", String(structuredRules.maxCaptionLength)),
      type: "caption_length",
      severity: "high",
      quote: null,
      issue: `标题文案超过 Brief 设定的 ${structuredRules.maxCaptionLength} 字上限。`,
      suggestion: "精简标题文案后重新提交审核。",
      origin: "deterministic",
      source: "brief",
      rule_id: ruleId,
      rule_version: CONTENT_POLICY_VERSION,
      blocking: true,
      field: "caption",
    });
  }

  const ruleSetVersion = `${CONTENT_POLICY_VERSION}:${digest({
    platform: normalizePolicyText(input.platform ?? ""),
    restrictedTerms: restrictedTerms.map(normalizePolicyText).sort(),
    structuredRules,
  }).slice(0, 20)}`;
  return {
    inputHash: hashContentInput(input),
    ruleSetVersion,
    findings,
    summary: {
      blockingFindingIds: findings.filter((finding) => finding.blocking).map((finding) => finding.id),
      structuredRules,
      policyVersion: CONTENT_POLICY_VERSION,
    },
  };
}

const severityRank = { low: 0, medium: 1, high: 2 } as const;
const decisionRank = { approved: 0, needs_revision: 1, rejected: 2 } as const;

export function mergeContentReview(
  ai: ContentReviewOutput,
  deterministic: DeterministicContentEvaluation,
): EffectiveContentReview {
  const notes: string[] = [];
  const aiFindings: EffectiveContentFinding[] = ai.findings.map((finding, index) => ({
    ...finding,
    id: `finding_${digest(["ai", index, finding.type, finding.quote, finding.issue]).slice(0, 20)}`,
    origin: "ai",
    source: "ai",
    rule_id: `ai:${finding.type}`,
    rule_version: "model-output-v1",
    blocking: false,
    field: "combined",
  }));
  const findings = [...deterministic.findings, ...aiFindings];
  const findingRisk = findings.reduce<"low" | "medium" | "high">(
    (risk, finding) => (severityRank[finding.severity] > severityRank[risk] ? finding.severity : risk),
    "low",
  );
  const riskLevel = severityRank[findingRisk] > severityRank[ai.risk_level] ? findingRisk : ai.risk_level;
  if (riskLevel !== ai.risk_level) notes.push("AI_RISK_LOWER_THAN_FINDINGS");

  let effectiveDecision = ai.decision;
  if (findings.some((finding) => finding.severity === "high") && decisionRank[effectiveDecision] < decisionRank.needs_revision) {
    effectiveDecision = "needs_revision";
    notes.push("AI_APPROVED_WITH_HIGH_FINDING");
  }
  if (deterministic.findings.length > 0 && decisionRank[effectiveDecision] < decisionRank.needs_revision) {
    effectiveDecision = "needs_revision";
  }

  return {
    ...ai,
    decision: effectiveDecision,
    risk_level: riskLevel,
    findings,
    normalization_notes: notes,
    input_hash: deterministic.inputHash,
    rule_set_version: deterministic.ruleSetVersion,
    deterministic_summary: deterministic.summary,
  };
}

export function storedFindingSummary(value: unknown): {
  blockingIds: string[];
  advisoryHighIds: string[];
} {
  if (!Array.isArray(value)) return { blockingIds: [], advisoryHighIds: [] };
  const blockingIds: string[] = [];
  const advisoryHighIds: string[] = [];
  for (const item of value) {
    const row = record(item);
    if (!row || typeof row.id !== "string" || row.severity !== "high") continue;
    if (row.blocking === true) blockingIds.push(row.id);
    else advisoryHighIds.push(row.id);
  }
  return { blockingIds, advisoryHighIds };
}
