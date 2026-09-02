import "server-only";
import { NextResponse } from "next/server";
import { ERROR_CODES, type ErrorCode } from "@/shared/constants/error-codes";

/** 业务错误：service/repository 层抛出，handler 统一映射为响应 */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public details?: unknown,
    public responseHeaders?: Record<string, string>,
  ) {
    super(message ?? ERROR_CODES[code].message);
    this.name = "ApiError";
  }

  get httpStatus(): number {
    return ERROR_CODES[this.code].status;
  }
}

export interface ResponseMeta {
  request_id: string;
  timestamp: string;
}

export interface Pagination {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
}

function meta(requestId: string): ResponseMeta {
  return { request_id: requestId, timestamp: new Date().toISOString() };
}

export function ok<T>(requestId: string, data: T, init?: { status?: number }): NextResponse {
  return NextResponse.json(
    { success: true, data, meta: meta(requestId) },
    { status: init?.status ?? 200 },
  );
}

export function okList<T>(
  requestId: string,
  items: T[],
  pagination: Pagination,
): NextResponse {
  return NextResponse.json({
    success: true,
    data: items,
    pagination,
    meta: meta(requestId),
  });
}

export function fail(
  requestId: string,
  code: ErrorCode,
  message?: string,
  details?: unknown,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message: message ?? ERROR_CODES[code].message,
        ...(details !== undefined ? { details } : {}),
      },
      meta: meta(requestId),
    },
    { status: ERROR_CODES[code].status, headers },
  );
}
