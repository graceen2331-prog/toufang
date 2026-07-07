import "server-only";
import { ApiError, type Pagination } from "@/server/api/envelope";
import { paginate } from "@/server/api/pagination";
import { runAgent } from "@/server/ai/agents/run-agent";
import { outreachPrompt, negotiationPrompt } from "@/server/ai/prompts/outreach";
import { checkpointRepository } from "@/server/modules/checkpoint/checkpoint.repository";
import { campaignRepository } from "@/server/modules/campaign/campaign.repository";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";
import {
  outreachRepository,
  type ThreadListParams,
  type ThreadWithRelations,
} from "./outreach.repository";
import { OUTREACH_MESSAGE_STATUS, assertTransition } from "@/shared/constants/status";
import type {
  NegotiationRecordDto,
  OutreachCandidateDto,
  OutreachMessageDto,
  OutreachThreadDetailDto,
  OutreachThreadListItemDto,
} from "@/shared/schemas/outreach";
import type { NegotiationRecord, OutreachMessage } from "@/generated/prisma/client";

function messageToDto(m: OutreachMessage): OutreachMessageDto {
  return {
    id: m.id,
    direction: m.direction,
    status: m.status,
    approval_status: m.approvalStatus,
    subject: m.subject,
    body: m.body,
    reply_intent: m.replyIntent,
    ai_generated: m.aiGenerated,
    model: m.model,
    prompt_key: m.promptKey,
    prompt_version: m.promptVersion,
    sent_at: m.sentAt?.toISOString() ?? null,
    created_at: m.createdAt.toISOString(),
  };
}

function negotiationToDto(n: NegotiationRecord): NegotiationRecordDto {
  const strategy = (n.strategy as { items?: string[]; required_approvals?: string[]; risk_notes?: string[]; intent?: string; intent_summary?: string; reply_draft?: string }) ?? {};
  return {
    id: n.id,
    status: n.status,
    quoted_price_cents: n.quotedPriceCents,
    counter_price_cents: n.counterPriceCents,
    agreed_price_cents: n.agreedPriceCents,
    intent: strategy.intent ?? null,
    intent_summary: strategy.intent_summary ?? null,
    pricing_analysis: (n.pricingAnalysis as Record<string, unknown>) ?? {},
    strategy: strategy.items ?? [],
    reply_draft: strategy.reply_draft ?? null,
    required_approvals: strategy.required_approvals ?? [],
    risk_notes: strategy.risk_notes ?? [],
    agreed_terms: (n.agreedTerms as Record<string, unknown>) ?? {},
    created_at: n.createdAt.toISOString(),
    updated_at: n.updatedAt.toISOString(),
  };
}

function threadToListItem(
  t: ThreadWithRelations,
  pendingSet: Set<string>,
): OutreachThreadListItemDto {
  return {
    id: t.id,
    campaign_creator_id: t.campaignCreatorId,
    campaign_id: t.campaignCreator.campaign.id,
    campaign_name: t.campaignCreator.campaign.name,
    creator_id: t.campaignCreator.creator.id,
    creator_name: t.campaignCreator.creator.displayName,
    channel: t.channel,
    status: t.status,
    subject: t.subject,
    message_count: t._count.messages,
    last_message_at: t.lastMessageAt?.toISOString() ?? null,
    has_pending_approval: pendingSet.has(t.id),
    created_at: t.createdAt.toISOString(),
  };
}

export async function listThreads(
  ctx: TenantCtx,
  params: ThreadListParams,
): Promise<{ items: OutreachThreadListItemDto[]; pagination: Pagination }> {
  const rows = await outreachRepository.listThreads(ctx, params);
  const { items, pagination } = paginate(rows, params.limit);
  const pendingSet = await outreachRepository.hasPendingApproval(
    ctx,
    items.map((t) => t.id),
  );
  return { items: items.map((t) => threadToListItem(t, pendingSet)), pagination };
}

export async function listOutreachCandidates(
  ctx: TenantCtx,
  campaignId: string,
): Promise<OutreachCandidateDto[]> {
  const campaign = await campaignRepository.findById(ctx, campaignId);
  if (!campaign) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 不存在");

  const creators = await campaignRepository.listCreators(ctx, campaignId);
  const threads = await outreachRepository.listThreadsByCampaignCreatorIds(
    ctx,
    creators.map((cc) => cc.id),
  );
  const threadByCampaignCreator = new Map<string, (typeof threads)[number]>();
  for (const thread of threads) {
    if (!threadByCampaignCreator.has(thread.campaignCreatorId)) {
      threadByCampaignCreator.set(thread.campaignCreatorId, thread);
    }
  }

  return creators.map((cc) => {
    const thread = threadByCampaignCreator.get(cc.id);
    const isContactable = CONTACTABLE_STATUSES.has(cc.status);
    return {
      campaign_creator_id: cc.id,
      campaign_id: cc.campaignId,
      creator_id: cc.creatorId,
      creator_name: cc.creator.displayName,
      status: cc.status,
      role: cc.role,
      quoted_price_cents: cc.quotedPriceCents,
      agreed_price_cents: cc.agreedPriceCents,
      can_create_thread: isContactable && !thread,
      blocked_reason: isContactable ? null : "需先把达人推进到已批准或执行中状态",
      existing_thread_id: thread?.id ?? null,
      existing_thread_status: thread?.status ?? null,
      existing_thread_subject: thread?.subject ?? null,
    };
  });
}

export async function getThread(ctx: TenantCtx, id: string): Promise<OutreachThreadDetailDto> {
  const thread = await outreachRepository.findThread(ctx, id);
  if (!thread) throw new ApiError("RESOURCE_NOT_FOUND", "外联会话不存在");
  const [messages, negotiations, pendingSet] = await Promise.all([
    outreachRepository.listMessages(ctx, id),
    outreachRepository.listNegotiations(ctx, id),
    outreachRepository.hasPendingApproval(ctx, [id]),
  ]);
  return {
    ...threadToListItem(thread, pendingSet),
    messages: messages.map(messageToDto),
    negotiations: negotiations.map(negotiationToDto),
    campaign_creator_status: thread.campaignCreator.status,
    budget_remaining_cents: null, // 预算护栏在合同环节校验
  };
}

/** 创建外联会话：达人必须已批准（approved 及之后的执行态） */
const CONTACTABLE_STATUSES = new Set([
  "approved", "contacted", "replied", "negotiating", "confirmed", "contracting", "active",
]);

export async function createThread(
  ctx: TenantCtx,
  input: { campaign_creator_id: string; channel: string; subject?: string | null },
): Promise<OutreachThreadDetailDto> {
  const cc = await campaignRepository.findCampaignCreator(ctx, input.campaign_creator_id);
  if (!cc) throw new ApiError("RESOURCE_NOT_FOUND", "Campaign 达人不存在");
  if (!CONTACTABLE_STATUSES.has(cc.status)) {
    throw new ApiError("CONFLICT", `达人当前状态（${cc.status}）不可外联，需先批准入围`);
  }
  const existing = await outreachRepository.findThreadByCampaignCreator(
    ctx,
    input.campaign_creator_id,
  );
  if (existing) return getThread(ctx, existing.id);

  const thread = await outreachRepository.createThread(ctx, {
    campaignCreatorId: input.campaign_creator_id,
    channel: input.channel,
    subject: input.subject ?? null,
  });
  return getThread(ctx, thread.id);
}

/** AI 起草外联消息（草稿态，待人工审批） */
export async function draftOutreachMessage(
  ctx: TenantCtx,
  threadId: string,
  instruction?: string | null,
): Promise<OutreachMessageDto> {
  const thread = await outreachRepository.findThread(ctx, threadId);
  if (!thread) throw new ApiError("RESOURCE_NOT_FOUND", "外联会话不存在");

  // 汇集上下文：campaign/brand/brief/creator + 历史消息
  const campaign = await outreachRepository.getCampaignWithBrand(
    ctx,
    thread.campaignCreator.campaign.id,
  );
  const creator = await outreachRepository.getCreatorWithAccounts(
    ctx,
    thread.campaignCreator.creator.id,
  );
  const briefText = await outreachRepository.getCurrentBriefText(ctx, campaign?.id ?? "");
  const history = await outreachRepository.listMessages(ctx, threadId);

  const context = {
    campaign: { name: campaign?.name, objective: campaign?.objective },
    brand: {
      name: campaign?.brand.name,
      guidelines: campaign?.brand.guidelines,
      restricted_terms: campaign?.brand.restrictedTerms,
    },
    brief_summary: briefText?.slice(0, 1500) ?? null,
    creator: {
      display_name: creator?.displayName,
      bio: creator?.bio,
      categories: creator?.categories,
      accounts: creator?.platformAccounts.map((a) => ({
        platform: a.platform,
        followers: a.followers,
        engagement_rate: a.engagementRate,
      })),
    },
    history: history.slice(-6).map((m) => ({ direction: m.direction, body: m.body.slice(0, 500) })),
    instruction: instruction ?? null,
  };

  const { output, agentRunId } = await runAgent({
    tenantId: ctx.orgId,
    agentKey: "outreach",
    prompt: outreachPrompt,
    userMessage: `请起草外联消息：\n${JSON.stringify(context, null, 2)}`,
    createdBy: ctx.userId ?? null,
  });

  const agentRun = await outreachRepository.getAgentRunTrace(agentRunId);

  const message = await outreachRepository.createMessage(ctx, {
    threadId,
    direction: "outbound",
    status: "draft",
    approvalStatus: "not_required",
    subject: output.subject,
    body: output.body,
    aiGenerated: true,
    agentRunId,
    promptKey: agentRun?.promptKey ?? null,
    promptVersion: agentRun?.promptVersion ?? null,
    model: agentRun?.model ?? null,
  });
  await outreachRepository.touchThread(ctx, threadId);
  return messageToDto(message);
}

/** 手动新增消息：outbound 为草稿；inbound 记录达人回复并联动线程/达人状态 */
export async function addMessage(
  ctx: TenantCtx,
  threadId: string,
  input: { direction: "outbound" | "inbound"; subject?: string | null; body: string },
): Promise<OutreachMessageDto> {
  const thread = await outreachRepository.findThread(ctx, threadId);
  if (!thread) throw new ApiError("RESOURCE_NOT_FOUND", "外联会话不存在");

  const message = await outreachRepository.createMessage(ctx, {
    threadId,
    direction: input.direction,
    status: input.direction === "inbound" ? "replied" : "draft",
    approvalStatus: "not_required",
    subject: input.subject ?? null,
    body: input.body,
  });
  await outreachRepository.touchThread(ctx, threadId);

  if (input.direction === "inbound") {
    await outreachRepository.updateThreadStatus(ctx, threadId, "replied");
    // 达人推进到 replied（若当前是 contacted）
    const cc = await campaignRepository.findCampaignCreator(ctx, thread.campaignCreatorId);
    if (cc && cc.status === "contacted") {
      await campaignRepository.transitionCreatorField(
        ctx, cc.id, "status", "contacted", "replied", "收到达人回复", "user",
      );
    }
  }
  return messageToDto(message);
}

/**
 * 消息状态转移。关键闸门：
 * - draft → pending_approval 时自动创建 human_checkpoint（对外发送审批）
 * - 只有 approved 的消息才能 → sent（状态机保证）
 * - → sent 时联动线程与达人状态
 */
export async function transitionMessage(
  ctx: TenantCtx,
  messageId: string,
  to: string,
  reason?: string | null,
): Promise<void> {
  const message = await outreachRepository.findMessage(ctx, messageId);
  if (!message) throw new ApiError("RESOURCE_NOT_FOUND", "消息不存在");
  if (message.direction !== "outbound") {
    throw new ApiError("VALIDATION_FAILED", "只有外发消息有状态流转");
  }
  assertTransition(OUTREACH_MESSAGE_STATUS, message.status, to);
  if (message.status === "pending_approval" && to === "approved") {
    throw new ApiError("CONFLICT", "请在审批中心批准外联消息，不能直接绕过审批门");
  }

  const extra: Record<string, unknown> = {};
  if (to === "pending_approval") extra.approvalStatus = "pending";
  if (to === "sent") extra.sentAt = new Date();

  await outreachRepository.transitionMessage(ctx, messageId, message.status, to, reason ?? null, extra);

  if (to === "pending_approval") {
    const thread = await outreachRepository.findThread(ctx, message.threadId);
    await checkpointRepository.create(ctx, {
      type: "outreach_send",
      status: "pending",
      title: `外联消息发送审批：${thread?.campaignCreator.creator.displayName ?? ""}`,
      summary: message.body.slice(0, 200),
      entityType: "outreach_message",
      entityId: messageId,
      payload: { subject: message.subject, body: message.body, thread_id: message.threadId },
      priority: "high",
      assigneeRole: "manager",
    });
  }

  if (to === "sent") {
    const thread = await outreachRepository.findThread(ctx, message.threadId);
    if (thread) {
      await outreachRepository.touchThread(ctx, thread.id);
      const cc = await campaignRepository.findCampaignCreator(ctx, thread.campaignCreatorId);
      if (cc && cc.status === "approved") {
        await campaignRepository.transitionCreatorField(
          ctx, cc.id, "status", "approved", "contacted", "外联消息已发送", "user",
        );
      }
    }
  }
}

/** 外联发送审批决策后的联动（checkpoint.service 调用） */
export async function onOutreachApprovalDecided(
  ctx: TenantCtx,
  messageId: string,
  decision: "approved" | "rejected" | "changes_requested",
): Promise<void> {
  const message = await outreachRepository.findMessage(ctx, messageId);
  if (!message || message.status !== "pending_approval") return;
  if (decision === "approved") {
    await outreachRepository.transitionMessage(ctx, messageId, "pending_approval", "approved", "审批通过", {
      approvalStatus: "approved",
    });
  } else {
    await outreachRepository.transitionMessage(ctx, messageId, "pending_approval", "draft", "审批驳回，退回草稿", {
      approvalStatus: "rejected",
    });
  }
}

/** AI 谈判分析：基于达人回复产出报价分析/策略/回复草稿，落 negotiation_records */
export async function analyzeNegotiation(
  ctx: TenantCtx,
  threadId: string,
  input: { reply_message_id?: string | null; reply_text?: string | null; quoted_price_cents?: number | null },
): Promise<NegotiationRecordDto> {
  const thread = await outreachRepository.findThread(ctx, threadId);
  if (!thread) throw new ApiError("RESOURCE_NOT_FOUND", "外联会话不存在");

  let replyText = input.reply_text ?? null;
  if (!replyText && input.reply_message_id) {
    const replyMessage = await outreachRepository.findMessage(ctx, input.reply_message_id);
    replyText = replyMessage?.body ?? null;
  }
  if (!replyText) throw new ApiError("VALIDATION_FAILED", "缺少达人回复内容");

  const campaign = await outreachRepository.getCampaignWithBrand(
    ctx,
    thread.campaignCreator.campaign.id,
  );
  const creator = await outreachRepository.getCreatorWithAccounts(
    ctx,
    thread.campaignCreator.creator.id,
  );

  const context = {
    reply: replyText,
    quoted_price_cents: input.quoted_price_cents ?? null,
    campaign_budget_total_cents: campaign?.budgetTotalCents,
    creator: {
      display_name: creator?.displayName,
      accounts: creator?.platformAccounts.map((a) => ({
        platform: a.platform,
        followers: a.followers,
        engagement_rate: a.engagementRate,
      })),
    },
  };

  const { output, agentRunId } = await runAgent({
    tenantId: ctx.orgId,
    agentKey: "negotiation",
    prompt: negotiationPrompt,
    userMessage: `请分析这条达人回复并给出谈判建议：\n${JSON.stringify(context, null, 2)}`,
    createdBy: ctx.userId ?? null,
  });

  const record = await outreachRepository.createNegotiation(ctx, {
    threadId,
    status: output.intent === "negotiate" ? "negotiating" : "analyzing",
    quotedPriceCents: input.quoted_price_cents ?? null,
    counterPriceCents: output.pricing_analysis.suggested_counter_cents,
    pricingAnalysis: output.pricing_analysis as object,
    strategy: {
      items: output.strategy,
      intent: output.intent,
      intent_summary: output.intent_summary,
      reply_draft: output.reply_draft,
      required_approvals: output.required_approvals,
      risk_notes: output.risk_notes,
    } as object,
    agentRunId,
  });

  // 线程与达人状态联动
  if (output.intent === "negotiate") {
    await outreachRepository.updateThreadStatus(ctx, threadId, "negotiating");
    const cc = await campaignRepository.findCampaignCreator(ctx, thread.campaignCreatorId);
    if (cc && cc.status === "replied") {
      await campaignRepository.transitionCreatorField(
        ctx, cc.id, "status", "replied", "negotiating", "进入谈判", "agent",
      );
    }
  }
  // 达人回复消息标注意图
  if (input.reply_message_id) {
    await outreachRepository.updateMessage(ctx, input.reply_message_id, {
      replyIntent: output.intent,
    });
  }

  return negotiationToDto(
    (await outreachRepository.findNegotiation(ctx, record.id))!,
  );
}

/** 确认合作条款：需要 negotiation_terms 审批门（金额超预算余量时强制） */
export async function confirmTerms(
  ctx: TenantCtx,
  negotiationId: string,
  terms: {
    agreed_price_cents: number;
    deliverables: string[];
    usage_rights?: string | null;
    payment_terms?: string | null;
    notes?: string | null;
  },
): Promise<NegotiationRecordDto> {
  const negotiation = await outreachRepository.findNegotiation(ctx, negotiationId);
  if (!negotiation) throw new ApiError("RESOURCE_NOT_FOUND", "谈判记录不存在");

  const thread = await outreachRepository.findThread(ctx, negotiation.threadId);
  if (!thread) throw new ApiError("RESOURCE_NOT_FOUND", "外联会话不存在");

  await outreachRepository.updateNegotiation(ctx, negotiationId, {
    status: "agreed",
    agreedPriceCents: terms.agreed_price_cents,
    agreedTerms: {
      deliverables: terms.deliverables,
      usage_rights: terms.usage_rights ?? null,
      payment_terms: terms.payment_terms ?? null,
      notes: terms.notes ?? null,
    } as object,
  });

  // 达人推进 negotiating → confirmed，价格写入 campaign_creator
  const cc = await campaignRepository.findCampaignCreator(ctx, thread.campaignCreatorId);
  if (cc) {
    await outreachRepository.updateCampaignCreatorTerms(
      ctx, cc.id, terms.agreed_price_cents, terms.deliverables,
    );
    if (["replied", "negotiating"].includes(cc.status)) {
      await campaignRepository.transitionCreatorField(
        ctx, cc.id, "status", cc.status, "confirmed", "合作条款确认", "user",
      );
    }
  }
  await outreachRepository.updateThreadStatus(ctx, thread.id, "closed_won");

  return negotiationToDto((await outreachRepository.findNegotiation(ctx, negotiationId))!);
}
