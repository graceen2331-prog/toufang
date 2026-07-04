import { z } from "zod";

export const KnowledgeDocumentCreateSchema = z.object({
  title: z.string().min(1, "请输入文档标题").max(200),
  content: z.string().min(1, "请输入文档内容").max(200_000),
  type: z.enum(["document", "brief", "report", "research", "summary", "sop", "note"]).default("document"),
  visibility: z.enum(["workspace", "team", "private"]).default("workspace"),
  source_type: z.enum(["upload", "campaign_report", "research", "learning"]).default("upload"),
  source_id: z.string().nullish(),
  brand_id: z.string().nullish(),
  campaign_id: z.string().nullish(),
});
export type KnowledgeDocumentCreateInput = z.infer<typeof KnowledgeDocumentCreateSchema>;

export const KnowledgeQuerySchema = z.object({
  question: z.string().min(1, "请输入问题").max(2000),
  filters: z
    .object({
      brand_id: z.string().nullish(),
      campaign_id: z.string().nullish(),
      document_type: z.array(z.string()).optional(),
    })
    .optional(),
  top_k: z.number().int().min(1).max(10).default(5),
  citation_required: z.boolean().default(true),
});
export type KnowledgeQueryInput = z.infer<typeof KnowledgeQuerySchema>;

export interface KnowledgeDocumentDto {
  id: string;
  title: string;
  type: string;
  status: string;
  visibility: string;
  source_type: string | null;
  source_id: string | null;
  brand_id: string | null;
  campaign_id: string | null;
  chunk_count: number;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeCitationDto {
  index: number;
  chunk_id: string;
  document_id: string;
  title: string;
  quote: string;
  score: number;
}

export interface KnowledgeAnswerDto {
  query_id: string;
  answer: string;
  confidence: number;
  citations: KnowledgeCitationDto[];
  missing_knowledge: string[];
}

export interface RagQueryDto {
  id: string;
  query: string;
  answer: string | null;
  citations: KnowledgeCitationDto[];
  feedback: string | null;
  latency_ms: number;
  created_at: string;
}
