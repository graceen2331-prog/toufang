import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError, fail, ok, okList, type Pagination } from "@/server/api/envelope";
import { getAuthContext, requirePermission, type AuthContext } from "@/server/auth/context";
import { writeAuditLog } from "@/server/modules/audit/audit.service";
import { InvalidTransitionError } from "@/shared/constants/status";
import type { Permission } from "@/shared/constants/permissions";
import { validateMutationOrigin } from "@/server/auth/request-origin";

const PAGINATED = Symbol("paginated");

interface PaginatedResult<T> {
  [PAGINATED]: true;
  items: T[];
  pagination: Pagination;
}

/** handler 返回列表时用它包裹，信封层会展开为 data + pagination */
export function paginated<T>(items: T[], pagination: Pagination): PaginatedResult<T> {
  return { [PAGINATED]: true, items, pagination };
}

function isPaginated(value: unknown): value is PaginatedResult<unknown> {
  return typeof value === "object" && value !== null && PAGINATED in value;
}

export interface ApiContext<TBody> {
  req: NextRequest;
  requestId: string;
  params: Record<string, string>;
  searchParams: URLSearchParams;
  body: TBody;
  /** auth: false 的公开端点上为 null */
  auth: AuthContext;
  /** 写操作自动审计之外的补充信息 */
  setAuditEntity: (entityType: string, entityId: string, metadata?: Record<string, unknown>) => void;
}

interface CreateHandlerOptions<TBody> {
  /** 需要的权限；不传 = 仅需登录 */
  permission?: Permission;
  /** false = 公开端点（登录、注册） */
  auth?: boolean;
  /** 请求体 Zod 校验（POST/PATCH） */
  body?: ZodType<TBody>;
  /** 审计动作名（如 brand.create）；传入则自动写 audit_logs */
  audit?: string;
  /** 创建成功返回 201 */
  created?: boolean;
  handler: (ctx: ApiContext<TBody>) => Promise<unknown>;
}

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * API 路由统一组合器：
 * requestId → 认证 → 权限 → Zod 校验 → 业务 handler → 审计 → 信封序列化 → 错误映射
 */
export function createApiHandler<TBody = unknown>(options: CreateHandlerOptions<TBody>) {
  return async (req: NextRequest, routeCtx?: RouteContext): Promise<NextResponse> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    try {
      validateMutationOrigin(req);
      // 认证与权限
      let auth: AuthContext | null = null;
      if (options.auth !== false) {
        auth = await getAuthContext();
        if (options.permission) requirePermission(auth, options.permission);
      }

      // 请求体校验
      let body: TBody = undefined as TBody;
      if (options.body) {
        let raw: unknown;
        try {
          raw = await req.json();
        } catch {
          throw new ApiError("VALIDATION_FAILED", "请求体必须是合法 JSON");
        }
        body = options.body.parse(raw);
      }

      const params = routeCtx ? await routeCtx.params : {};
      const auditRef: {
        current: { entityType: string; entityId: string; metadata?: Record<string, unknown> } | null;
      } = { current: null };

      const result = await options.handler({
        req,
        requestId,
        params,
        searchParams: req.nextUrl.searchParams,
        body,
        auth: auth as AuthContext,
        setAuditEntity: (entityType, entityId, metadata) => {
          auditRef.current = { entityType, entityId, ...(metadata ? { metadata } : {}) };
        },
      });

      // 审计（不阻塞主流程，失败仅记日志）
      if (options.audit && auth) {
        void writeAuditLog({
          tenantId: auth.orgId,
          requestId,
          actorType: "user",
          actorId: auth.userId,
          action: options.audit,
          entityType: auditRef.current?.entityType ?? null,
          entityId: auditRef.current?.entityId ?? null,
          metadata: auditRef.current?.metadata ?? {},
        });
      }

      if (result instanceof NextResponse) return result;
      if (isPaginated(result)) return okList(requestId, result.items, result.pagination);
      return ok(requestId, result, options.created ? { status: 201 } : undefined);
    } catch (err) {
      return mapError(requestId, err);
    }
  };
}

function mapError(requestId: string, err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return fail(requestId, err.code, err.message, err.details, err.responseHeaders);
  }
  if (err instanceof ZodError) {
    return fail(
      requestId,
      "VALIDATION_FAILED",
      undefined,
      err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  if (err instanceof InvalidTransitionError) {
    return fail(requestId, "INVALID_STATUS_TRANSITION", err.message);
  }
  console.error(`[api] 未处理错误 request_id=${requestId}`, err);
  return fail(requestId, "INTERNAL_ERROR");
}
