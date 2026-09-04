import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  generateChineseBrandName,
  generateChineseBrandProfile,
} from "../src/server/modules/brand-lead/brand-lead.localization";
import { scoreBrandLead } from "../src/server/modules/brand-lead/brand-lead.scoring";
import { normalizeExternalUrl } from "../src/shared/url";

const DEFAULT_SOURCE_URL =
  "https://raw.githubusercontent.com/aezizhu/CES-2026-Exhibitor-Database/master/output/CES%202026%20Exhibitor%20Database%20(Enriched%20with%20Funding%20%26%20Revenue%20Data).json";

interface CesExhibitorRow {
  name?: unknown;
  exhid?: unknown;
  detail_url?: unknown;
  booth_venue?: unknown;
  booth_number?: unknown;
  booth_full?: unknown;
  description?: unknown;
  website?: unknown;
  address?: unknown;
  product_categories?: unknown;
  hall_ids?: unknown;
  seek_funding?: unknown;
  funding_amount?: unknown;
  revenue?: unknown;
  investment_stage?: unknown;
  scraped_at?: unknown;
  country?: unknown;
}

interface ImportOptions {
  source: string;
  tenantSlug: string;
  createdByEmail: string;
  limit: number | null;
}

function parseArgs(argv: string[]): ImportOptions {
  const options: ImportOptions = {
    source: DEFAULT_SOURCE_URL,
    tenantSlug: "xinglan",
    createdByEmail: "admin@demo.com",
    limit: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--source" && next) {
      options.source = next;
      i += 1;
    } else if (arg === "--tenant-slug" && next) {
      options.tenantSlug = next;
      i += 1;
    } else if (arg === "--created-by-email" && next) {
      options.createdByEmail = next;
      i += 1;
    } else if (arg === "--limit" && next) {
      const parsed = Number(next);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      i += 1;
    }
  }

  return options;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function categories(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(";") : text(value);
  if (!raw) return [];
  return raw
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseCsv(input: string): CesExhibitorRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.length > 0)) rows.push(row);

  const [headers, ...records] = rows;
  if (!headers) return [];
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), record[index] ?? ""])),
  ) as CesExhibitorRow[];
}

async function loadRows(source: string): Promise<CesExhibitorRow[]> {
  const content =
    source.startsWith("http://") || source.startsWith("https://")
      ? await fetch(source).then(async (res) => {
          if (!res.ok) throw new Error(`下载失败：${res.status} ${res.statusText}`);
          return res.text();
        })
      : await readFile(source, "utf8");

  if (source.toLowerCase().endsWith(".csv")) return parseCsv(content);

  const json = JSON.parse(content) as { exhibitors?: CesExhibitorRow[] } | CesExhibitorRow[];
  if (Array.isArray(json)) return json;
  return json.exhibitors ?? [];
}

function toSourceId(row: CesExhibitorRow, index: number): string {
  return text(row.exhid) ?? `${text(row.name) ?? "unknown"}-${index + 1}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const [tenant, user] = await Promise.all([
      prisma.organization.findUnique({ where: { slug: options.tenantSlug } }),
      prisma.user.findUnique({ where: { email: options.createdByEmail } }),
    ]);
    if (!tenant) throw new Error(`找不到组织 slug=${options.tenantSlug}`);
    if (!user) throw new Error(`找不到用户 email=${options.createdByEmail}`);

    const rows = (await loadRows(options.source)).slice(0, options.limit ?? undefined);
    if (rows.length === 0) throw new Error("没有可导入的 CES 展商记录");

    await prisma.brandLead.updateMany({
      where: {
        tenantId: tenant.id,
        source: "ces_2026",
        sourceId: { startsWith: "CES-DEMO" },
        deletedAt: null,
      },
      data: { deletedAt: new Date(), deletedBy: user.id },
    });

    let imported = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const name = text(row.name);
      if (!name) {
        skipped += 1;
        continue;
      }

      const productCategories = categories(row.product_categories);
      const website = normalizeExternalUrl(text(row.website));
      const country = text(row.country);
      const description = text(row.description);
      const boothFull = text(row.booth_full);
      const seekFunding = text(row.seek_funding);
      const fundingAmount = text(row.funding_amount);
      const investmentStage = text(row.investment_stage);
      const scoring = scoreBrandLead({
        productCategories,
        country,
        description,
        website,
        seekFunding,
        fundingAmount,
        revenue: text(row.revenue),
        investmentStage,
      });
      const nameZh = generateChineseBrandName({ name, categories: productCategories });
      const brandProfileZh = generateChineseBrandProfile({
        name,
        nameZh,
        country,
        categories: productCategories,
        description,
        boothFull,
        seekFunding,
        fundingAmount,
        investmentStage,
        campaignAngles: scoring.campaignAngles,
        outreachSignals: scoring.outreachSignals,
      });

      await prisma.brandLead.upsert({
        where: {
          tenantId_source_sourceId: {
            tenantId: tenant.id,
            source: "ces_2026",
            sourceId: toSourceId(row, index),
          },
        },
        update: {
          name,
          nameZh,
          website,
          country,
          description,
          brandProfileZh,
          productCategories,
          boothVenue: text(row.booth_venue),
          boothNumber: text(row.booth_number),
          boothFull,
          seekFunding,
          fundingAmount,
          revenue: text(row.revenue),
          investmentStage,
          opportunityScore: scoring.score,
          opportunityTier: scoring.tier,
          recommendedCreatorProfile: scoring.recommendedCreatorProfile,
          campaignAngles: scoring.campaignAngles,
          outreachSignals: scoring.outreachSignals,
          rawData: {
            detail_url: text(row.detail_url),
            address: text(row.address),
            hall_ids: text(row.hall_ids),
            scraped_at: text(row.scraped_at),
            source_url: options.source,
          },
          updatedBy: user.id,
          deletedAt: null,
          deletedBy: null,
        },
        create: {
          tenantId: tenant.id,
          source: "ces_2026",
          sourceId: toSourceId(row, index),
          name,
          nameZh,
          website,
          country,
          description,
          brandProfileZh,
          productCategories,
          boothVenue: text(row.booth_venue),
          boothNumber: text(row.booth_number),
          boothFull,
          seekFunding,
          fundingAmount,
          revenue: text(row.revenue),
          investmentStage,
          opportunityScore: scoring.score,
          opportunityTier: scoring.tier,
          recommendedCreatorProfile: scoring.recommendedCreatorProfile,
          campaignAngles: scoring.campaignAngles,
          outreachSignals: scoring.outreachSignals,
          rawData: {
            detail_url: text(row.detail_url),
            address: text(row.address),
            hall_ids: text(row.hall_ids),
            scraped_at: text(row.scraped_at),
            source_url: options.source,
          },
          createdBy: user.id,
        },
      });

      imported += 1;
      if (imported % 500 === 0) console.log(`[ces-import] 已导入 ${imported}/${rows.length}`);
    }

    const total = await prisma.brandLead.count({
      where: { tenantId: tenant.id, source: "ces_2026", deletedAt: null },
    });
    console.log(
      `[ces-import] 完成：导入/更新 ${imported} 条，跳过 ${skipped} 条，当前 CES 线索 ${total} 条`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[ces-import] 失败", err);
  process.exit(1);
});
