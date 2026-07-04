import { createHash } from "node:crypto";

export interface KnowledgeChunkDraft {
  chunkIndex: number;
  content: string;
  contentHash: string;
  headingPath: string | null;
  metadata: Record<string, unknown>;
}

export interface ChunkTextOptions {
  maxChars?: number;
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 3200;
const DEFAULT_OVERLAP_CHARS = 400;

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function splitLongParagraph(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph];
  const parts: string[] = [];
  for (let start = 0; start < paragraph.length; start += maxChars) {
    parts.push(paragraph.slice(start, start + maxChars));
  }
  return parts;
}

function headingFromParagraph(paragraph: string): string | null {
  const match = paragraph.match(/^(#{1,6})\s+(.+)$/);
  return match ? match[2]!.trim() : null;
}

/** 纯文本/Markdown 分块：约 800 token（中文按 4 字符粗估）并保留少量重叠上下文。 */
export function chunkText(text: string, options: ChunkTextOptions = {}): KnowledgeChunkDraft[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = Math.min(options.overlapChars ?? DEFAULT_OVERLAP_CHARS, Math.floor(maxChars / 2));
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .flatMap((paragraph) => splitLongParagraph(paragraph.trim(), maxChars))
    .filter(Boolean);

  const chunks: string[] = [];
  const headings: Array<string | null> = [];
  let current = "";
  let currentHeading: string | null = null;

  for (const paragraph of paragraphs) {
    const heading = headingFromParagraph(paragraph);
    if (heading) currentHeading = heading;
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxChars && current) {
      chunks.push(current);
      headings.push(currentHeading);
      const overlap = current.slice(Math.max(0, current.length - overlapChars));
      current = overlap ? `${overlap}\n\n${paragraph}` : paragraph;
    } else {
      current = next;
    }
  }
  if (current) {
    chunks.push(current);
    headings.push(currentHeading);
  }

  return chunks.map((content, index) => ({
    chunkIndex: index,
    content,
    contentHash: hashContent(content),
    headingPath: headings[index] ?? null,
    metadata: {
      char_count: content.length,
      estimated_tokens: Math.ceil(content.length / 4),
    },
  }));
}
