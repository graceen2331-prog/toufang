import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { brandRepository, type TenantCtx } from "./brand.repository";
import type { Brand } from "@/generated/prisma/client";
import type { BrandCreateInput, BrandDto, BrandUpdateInput } from "@/shared/schemas/brand";

function toDto(brand: Brand, productCount?: number): BrandDto {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    description: brand.description,
    industry: brand.industry,
    markets: (brand.markets as string[]) ?? [],
    guidelines: (brand.guidelines as Record<string, string>) ?? {},
    restricted_terms: (brand.restrictedTerms as string[]) ?? [],
    ...(productCount !== undefined ? { product_count: productCount } : {}),
    created_at: brand.createdAt.toISOString(),
    updated_at: brand.updatedAt.toISOString(),
  };
}

export async function listBrands(
  ctx: TenantCtx,
  params: { limit: number; cursor: string | null; order: "asc" | "desc"; q: string | null },
): Promise<{ items: BrandDto[]; pagination: Pagination }> {
  const rows = await brandRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  const counts = await brandRepository.countProducts(
    ctx,
    items.map((b) => b.id),
  );
  return { items: items.map((b) => toDto(b, counts.get(b.id) ?? 0)), pagination };
}

export async function getBrand(ctx: TenantCtx, id: string): Promise<BrandDto> {
  const brand = await brandRepository.findById(ctx, id);
  if (!brand) throw new ApiError("RESOURCE_NOT_FOUND", "品牌不存在");
  return toDto(brand);
}

export async function createBrand(ctx: TenantCtx, input: BrandCreateInput): Promise<BrandDto> {
  const existing = await brandRepository.findBySlug(ctx, input.slug);
  if (existing) throw new ApiError("CONFLICT", `品牌标识 "${input.slug}" 已存在`);
  const brand = await brandRepository.create(ctx, {
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    industry: input.industry ?? null,
    markets: input.markets,
    guidelines: input.guidelines,
    restrictedTerms: input.restricted_terms,
  });
  return toDto(brand);
}

export async function updateBrand(
  ctx: TenantCtx,
  id: string,
  input: BrandUpdateInput,
): Promise<BrandDto> {
  const existing = await brandRepository.findById(ctx, id);
  if (!existing) throw new ApiError("RESOURCE_NOT_FOUND", "品牌不存在");
  const brand = await brandRepository.update(ctx, id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.industry !== undefined ? { industry: input.industry } : {}),
    ...(input.markets !== undefined ? { markets: input.markets } : {}),
    ...(input.guidelines !== undefined ? { guidelines: input.guidelines } : {}),
    ...(input.restricted_terms !== undefined ? { restrictedTerms: input.restricted_terms } : {}),
  });
  return toDto(brand);
}

export async function deleteBrand(ctx: TenantCtx, id: string): Promise<void> {
  const existing = await brandRepository.findById(ctx, id);
  if (!existing) throw new ApiError("RESOURCE_NOT_FOUND", "品牌不存在");
  await brandRepository.softDelete(ctx, id);
}
