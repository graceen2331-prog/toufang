// 统一 API 客户端：拆信封、抛类型化错误
// 所有服务器数据必须经 TanStack Query + 本文件访问，禁止散落的 fetch

export interface ApiPagination {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
}

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** query 参数；null/undefined 的键自动忽略 */
  params?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, params?: FetchOptions["params"]): string {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request(path: string, options: FetchOptions = {}): Promise<unknown> {
  const res = await fetch(buildUrl(path, options.params), {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : {},
    body: options.body !== undefined ? JSON.stringify(options.body) : null,
    signal: options.signal ?? null,
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiClientError("INTERNAL_ERROR", "服务器响应格式异常", res.status);
  }

  const envelope = json as {
    success: boolean;
    data?: unknown;
    pagination?: ApiPagination;
    error?: { code: string; message: string; details?: unknown };
  };

  if (!envelope.success) {
    const err = envelope.error ?? { code: "INTERNAL_ERROR", message: "未知错误" };
    // 会话失效统一跳登录
    if (
      (err.code === "AUTH_REQUIRED" || err.code === "AUTH_SESSION_EXPIRED") &&
      window.location.pathname !== "/login"
    ) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiClientError(err.code, err.message, res.status, err.details);
  }
  return envelope;
}

export async function apiFetch<T>(path: string, options?: FetchOptions): Promise<T> {
  const envelope = (await request(path, options)) as { data: T };
  return envelope.data;
}

export async function apiFetchList<T>(
  path: string,
  options?: FetchOptions,
): Promise<{ items: T[]; pagination: ApiPagination }> {
  const envelope = (await request(path, options)) as { data: T[]; pagination: ApiPagination };
  return { items: envelope.data, pagination: envelope.pagination };
}
