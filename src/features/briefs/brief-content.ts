import type { BriefContent } from "@/shared/schemas/brief";

const EMPTY_BRIEF_CONTENT: BriefContent = {
  title: "未命名 Brief",
  background: "",
  product_positioning: "",
  key_messages: [],
  must_include: [],
  must_avoid: [],
  cta: "",
  deliverables: [],
  timeline_notes: "",
  platform_requirements: [],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeBriefContent(input: unknown): BriefContent {
  const content = asRecord(input);
  return {
    ...EMPTY_BRIEF_CONTENT,
    title: stringValue(content.title, EMPTY_BRIEF_CONTENT.title),
    background: stringValue(content.background),
    product_positioning: stringValue(content.product_positioning),
    key_messages: stringArray(content.key_messages),
    must_include: stringArray(content.must_include),
    must_avoid: stringArray(content.must_avoid),
    cta: stringValue(content.cta),
    deliverables: Array.isArray(content.deliverables)
      ? content.deliverables.map((item) => {
          const deliverable = asRecord(item);
          return {
            type: stringValue(deliverable.type, "内容"),
            count: typeof deliverable.count === "number" ? deliverable.count : 0,
            notes: stringValue(deliverable.notes),
          };
        })
      : [],
    timeline_notes: stringValue(content.timeline_notes),
    platform_requirements: Array.isArray(content.platform_requirements)
      ? content.platform_requirements.map((item) => {
          const requirement = asRecord(item);
          return {
            platform: stringValue(requirement.platform, "未指定平台"),
            requirements: stringArray(requirement.requirements),
          };
        })
      : [],
  };
}
