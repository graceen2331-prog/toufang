import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { brandRepository, type TenantCtx } from "@/server/modules/brand/brand.repository";
import { productRepository } from "@/server/modules/product/product.repository";
import { getUserNames } from "@/server/modules/user/user.repository";
import { campaignRepository, type CampaignListParams, type CampaignWithBrand } from "./campaign.repository";
import {
  CAMPAIGN_CREATOR_STATUS,
  CAMPAIGN_STATUS,
  CONTENT_SUB_STATUS,
  CONTRACT_SUB_STATUS,
  PAYMENT_SUB_STATUS,
  assertTransition,
} from "@/shared/constants/status";
import type {
  BudgetItemDto,
  BudgetItemInput,
  CampaignCreateInput,
  CampaignCreatorDto,
  CampaignDetailDto,
  CampaignListItemDto,
  CampaignTaskDto,
  CampaignTaskInput,
  CampaignUpdateInput,
} from "@/shared/schemas/campaign";

async function toListItem(c: CampaignWithBrand, ownerName: string | null): Promise<CampaignListItemDto> {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    health_status: c.healthStatus,
    brand_id: c.brandId,
    brand_name: c.brand.name,
    objective: c.objective,
    platforms: (c.platforms as string[]) ?? [],
    budget_total_cents: c.budgetTotalCents,
    currency: c.currency,
    creator_count: c._count.campaignCreators,
    owner_name: ownerName,
    start_date: c.startDate?.toISOString() ?? null,
    end_date: c.endDate?.toISOString() ?? null,
    created_at: c.createdAt.toISOString(),
  };
}

export async function listCampaigns(
  ctx: TenantCtx,
  params: CampaignListParams,
): Promise<{ items: CampaignListItemDto[]; pagination: Pagination }> {
  const rows = await campaignRepository.list(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  const names = await getUserNames(items.map((c) => c.ownerId).filter((v): v is string => !!v));
  return {
    items: await Promise.all(
      items.map((c) => toListItem(c, c.ownerId ? (names.get(c.ownerId) ?? null) : null)),
    ),
    pagination,
  };
}

export async function getCampaign(ctx: TenantCtx, id: string): Promise<CampaignDetailDto> {
  const campaign = await campaignRepository.findById(ctx, id);
  if (!campaign) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");
  const [names, budgetUsed, openTasks] = await Promise.all([
    getUserNames(campaign.ownerId ? [campaign.ownerId] : []),
    campaignRepository.budgetUsed(ctx, id),
    campaignRepository.openTaskCount(ctx, id),
  ]);
  let productName: string | null = null;
  if (campaign.productId) {
    const product = await productRepository.findById(ctx, campaign.productId);
    productName = product?.name ?? null;
  }
  const base = await toListItem(
    campaign,
    campaign.ownerId ? (names.get(campaign.ownerId) ?? null) : null,
  );
  return {
    ...base,
    product_id: campaign.productId,
    product_name: productName,
    markets: (campaign.markets as string[]) ?? [],
    goals: (campaign.goals as Record<string, number | string>) ?? {},
    budget_used_cents: budgetUsed,
    task_open_count: openTasks,
    updated_at: campaign.updatedAt.toISOString(),
  };
}

export async function createCampaign(
  ctx: TenantCtx,
  input: CampaignCreateInput,
): Promise<CampaignDetailDto> {
  const brand = await brandRepository.findById(ctx, input.brand_id);
  if (!brand) throw new ApiError("RESOURCE_NOT_FOUND", "品牌不存在");
  if (input.product_id) {
    const product = await productRepository.findById(ctx, input.product_id);
    if (!product) throw new ApiError("RESOURCE_NOT_FOUND", "产品不存在");
    if (product.brandId !== input.brand_id) {
      throw new ApiError("VALIDATION_FAILED", "产品不属于所选品牌");
    }
  }
  const campaign = await campaignRepository.create(ctx, {
    name: input.name,
    brandId: input.brand_id,
    productId: input.product_id ?? null,
    objective: input.objective ?? null,
    markets: input.markets,
    platforms: input.platforms,
    budgetTotalCents: input.budget_total_cents,
    currency: input.currency,
    goals: input.goals,
    startDate: input.start_date ? new Date(input.start_date) : null,
    endDate: input.end_date ? new Date(input.end_date) : null,
  });
  return getCampaign(ctx, campaign.id);
}

export async function updateCampaign(
  ctx: TenantCtx,
  id: string,
  input: CampaignUpdateInput,
): Promise<CampaignDetailDto> {
  const existing = await campaignRepository.findById(ctx, id);
  if (!existing) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");
  await campaignRepository.update(ctx, id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.product_id !== undefined ? { productId: input.product_id } : {}),
    ...(input.objective !== undefined ? { objective: input.objective } : {}),
    ...(input.markets !== undefined ? { markets: input.markets } : {}),
    ...(input.platforms !== undefined ? { platforms: input.platforms } : {}),
    ...(input.budget_total_cents !== undefined
      ? { budgetTotalCents: input.budget_total_cents }
      : {}),
    ...(input.goals !== undefined ? { goals: input.goals } : {}),
    ...(input.start_date !== undefined
      ? { startDate: input.start_date ? new Date(input.start_date) : null }
      : {}),
    ...(input.end_date !== undefined
      ? { endDate: input.end_date ? new Date(input.end_date) : null }
      : {}),
  });
  return getCampaign(ctx, id);
}

export async function transitionCampaignStatus(
  ctx: TenantCtx,
  id: string,
  to: string,
  reason?: string | null,
  actorType: "user" | "system" | "agent" = "user",
): Promise<CampaignDetailDto> {
  const campaign = await campaignRepository.findById(ctx, id);
  if (!campaign) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");
  assertTransition(CAMPAIGN_STATUS, campaign.status, to);
  await campaignRepository.transitionStatus(ctx, id, campaign.status, to, reason ?? null, actorType);
  return getCampaign(ctx, id);
}

export async function deleteCampaign(ctx: TenantCtx, id: string): Promise<void> {
  const existing = await campaignRepository.findById(ctx, id);
  if (!existing) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");
  await campaignRepository.softDelete(ctx, id);
}

// ---- Campaign 达人 ----

export async function listCampaignCreators(
  ctx: TenantCtx,
  campaignId: string,
): Promise<CampaignCreatorDto[]> {
  const rows = await campaignRepository.listCreators(ctx, campaignId);
  return rows.map((cc) => ({
    id: cc.id,
    creator_id: cc.creatorId,
    creator_name: cc.creator.displayName,
    status: cc.status,
    contract_status: cc.contractStatus,
    payment_status: cc.paymentStatus,
    content_status: cc.contentStatus,
    role: cc.role,
    match_score: cc.matchScore,
    quoted_price_cents: cc.quotedPriceCents,
    agreed_price_cents: cc.agreedPriceCents,
    ai_generated: cc.aiGenerated,
    created_at: cc.createdAt.toISOString(),
  }));
}

export async function addCampaignCreators(
  ctx: TenantCtx,
  campaignId: string,
  creatorIds: string[],
  role: string | null,
): Promise<{ added: number }> {
  const campaign = await campaignRepository.findById(ctx, campaignId);
  if (!campaign) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");
  const added = await campaignRepository.addCreators(ctx, campaignId, creatorIds, role);
  return { added };
}

const SUB_STATUS_VALUES: Record<string, Set<string>> = {
  contract_status: new Set(Object.keys(CONTRACT_SUB_STATUS)),
  payment_status: new Set(Object.keys(PAYMENT_SUB_STATUS)),
  content_status: new Set(Object.keys(CONTENT_SUB_STATUS)),
};

export async function transitionCampaignCreator(
  ctx: TenantCtx,
  campaignCreatorId: string,
  field: "status" | "contract_status" | "payment_status" | "content_status",
  to: string,
  reason?: string | null,
  actorType: "user" | "system" | "agent" = "user",
): Promise<void> {
  const cc = await campaignRepository.findCampaignCreator(ctx, campaignCreatorId);
  if (!cc) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 达人不存在");

  if (field === "status") {
    assertTransition(CAMPAIGN_CREATOR_STATUS, cc.status, to);
    await campaignRepository.transitionCreatorField(
      ctx, campaignCreatorId, field, cc.status, to, reason ?? null, actorType,
    );
    return;
  }
  // 子状态：值域校验（不做转移图约束）
  if (!SUB_STATUS_VALUES[field]!.has(to)) {
    throw new ApiError("VALIDATION_FAILED", `非法的 ${field} 值：${to}`);
  }
  const current = {
    contract_status: cc.contractStatus,
    payment_status: cc.paymentStatus,
    content_status: cc.contentStatus,
  }[field];
  await campaignRepository.transitionCreatorField(
    ctx, campaignCreatorId, field, current, to, reason ?? null, actorType,
  );
}

export async function removeCampaignCreator(ctx: TenantCtx, id: string): Promise<void> {
  const cc = await campaignRepository.findCampaignCreator(ctx, id);
  if (!cc) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 达人不存在");
  await campaignRepository.removeCreator(ctx, id);
}

// ---- 任务 ----

export async function listCampaignTasks(ctx: TenantCtx, campaignId: string): Promise<CampaignTaskDto[]> {
  const tasks = await campaignRepository.listTasks(ctx, campaignId);
  const names = await getUserNames(tasks.map((t) => t.assigneeId).filter((v): v is string => !!v));
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assigneeId,
    assignee_name: t.assigneeId ? (names.get(t.assigneeId) ?? null) : null,
    due_at: t.dueAt?.toISOString() ?? null,
    created_at: t.createdAt.toISOString(),
  }));
}

export async function createCampaignTask(
  ctx: TenantCtx,
  campaignId: string,
  input: CampaignTaskInput,
): Promise<void> {
  const campaign = await campaignRepository.findById(ctx, campaignId);
  if (!campaign) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");
  await campaignRepository.createTask(ctx, {
    campaignId,
    title: input.title,
    description: input.description ?? null,
    priority: input.priority,
    assigneeId: input.assignee_id ?? null,
    dueAt: input.due_at ? new Date(input.due_at) : null,
  });
}

export async function updateCampaignTask(
  ctx: TenantCtx,
  taskId: string,
  input: Partial<CampaignTaskInput> & { status?: string },
): Promise<void> {
  await campaignRepository.updateTask(ctx, taskId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.assignee_id !== undefined ? { assigneeId: input.assignee_id } : {}),
    ...(input.due_at !== undefined ? { dueAt: input.due_at ? new Date(input.due_at) : null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });
}

export async function deleteCampaignTask(ctx: TenantCtx, taskId: string): Promise<void> {
  await campaignRepository.deleteTask(ctx, taskId);
}

// ---- 预算 ----

export async function listBudgetItems(ctx: TenantCtx, campaignId: string): Promise<BudgetItemDto[]> {
  const items = await campaignRepository.listBudgetItems(ctx, campaignId);
  return items.map((item) => ({
    id: item.id,
    category: item.category,
    name: item.name,
    planned_cents: item.plannedCents,
    reserved_cents: item.reservedCents,
    spent_cents: item.spentCents,
    related_type: item.relatedType,
    related_id: item.relatedId,
  }));
}

export async function createBudgetItem(
  ctx: TenantCtx,
  campaignId: string,
  input: BudgetItemInput,
): Promise<void> {
  const campaign = await campaignRepository.findById(ctx, campaignId);
  if (!campaign) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");
  await campaignRepository.createBudgetItem(ctx, {
    campaignId,
    category: input.category,
    name: input.name,
    plannedCents: input.planned_cents,
    reservedCents: input.reserved_cents,
    spentCents: input.spent_cents,
    currency: campaign.currency,
  });
}

export async function updateBudgetItem(
  ctx: TenantCtx,
  itemId: string,
  input: Partial<BudgetItemInput>,
): Promise<void> {
  await campaignRepository.updateBudgetItem(ctx, itemId, {
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.planned_cents !== undefined ? { plannedCents: input.planned_cents } : {}),
    ...(input.reserved_cents !== undefined ? { reservedCents: input.reserved_cents } : {}),
    ...(input.spent_cents !== undefined ? { spentCents: input.spent_cents } : {}),
  });
}

export async function deleteBudgetItem(ctx: TenantCtx, itemId: string): Promise<void> {
  await campaignRepository.deleteBudgetItem(ctx, itemId);
}
