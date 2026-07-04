import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { brandRepository, type TenantCtx } from "@/server/modules/brand/brand.repository";
import { productRepository } from "./product.repository";
import type { Product } from "@/generated/prisma/client";
import type { ProductCreateInput, ProductDto, ProductUpdateInput } from "@/shared/schemas/product";

function toDto(product: Product & { brand?: { name: string } }): ProductDto {
  return {
    id: product.id,
    brand_id: product.brandId,
    ...(product.brand ? { brand_name: product.brand.name } : {}),
    name: product.name,
    description: product.description,
    category: product.category,
    price: (product.price as { amount?: number; currency?: string }) ?? {},
    key_claims: (product.keyClaims as string[]) ?? [],
    restricted_claims: (product.restrictedClaims as string[]) ?? [],
    links: (product.links as string[]) ?? [],
    created_at: product.createdAt.toISOString(),
    updated_at: product.updatedAt.toISOString(),
  };
}

export async function listProducts(
  ctx: TenantCtx,
  params: {
    limit: number;
    cursor: string | null;
    order: "asc" | "desc";
    q: string | null;
    brandId: string | null;
  },
): Promise<{ items: ProductDto[]; pagination: Pagination }> {
  const rows = await productRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  return { items: items.map(toDto), pagination };
}

export async function getProduct(ctx: TenantCtx, id: string): Promise<ProductDto> {
  const product = await productRepository.findById(ctx, id);
  if (!product) throw new ApiError("RESOURCE_NOT_FOUND", "产品不存在");
  return toDto(product);
}

export async function createProduct(ctx: TenantCtx, input: ProductCreateInput): Promise<ProductDto> {
  const brand = await brandRepository.findById(ctx, input.brand_id);
  if (!brand) throw new ApiError("RESOURCE_NOT_FOUND", "品牌不存在");
  const product = await productRepository.create(ctx, {
    brandId: input.brand_id,
    name: input.name,
    description: input.description ?? null,
    category: input.category ?? null,
    price: input.price,
    keyClaims: input.key_claims,
    restrictedClaims: input.restricted_claims,
    links: input.links,
  });
  return toDto(product);
}

export async function updateProduct(
  ctx: TenantCtx,
  id: string,
  input: ProductUpdateInput,
): Promise<ProductDto> {
  const existing = await productRepository.findById(ctx, id);
  if (!existing) throw new ApiError("RESOURCE_NOT_FOUND", "产品不存在");
  const product = await productRepository.update(ctx, id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.price !== undefined ? { price: input.price } : {}),
    ...(input.key_claims !== undefined ? { keyClaims: input.key_claims } : {}),
    ...(input.restricted_claims !== undefined ? { restrictedClaims: input.restricted_claims } : {}),
    ...(input.links !== undefined ? { links: input.links } : {}),
  });
  if (!product) throw new ApiError("RESOURCE_NOT_FOUND", "产品不存在");
  return toDto(product);
}

export async function deleteProduct(ctx: TenantCtx, id: string): Promise<void> {
  const existing = await productRepository.findById(ctx, id);
  if (!existing) throw new ApiError("RESOURCE_NOT_FOUND", "产品不存在");
  await productRepository.softDelete(ctx, id);
}
