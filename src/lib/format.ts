/** 金额格式化辅助（服务端与客户端通用） */

/** 分转元并格式化为人民币字符串；空值返回“—”。 */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `¥${(cents / 100).toLocaleString("zh-CN")}`;
}

/** 元字符串转分；非有限数或负数返回 0。 */
export function yuanToCents(value: string): number {
  const normalized = Number(value.trim());
  if (!Number.isFinite(normalized) || normalized < 0) return 0;
  return Math.round(normalized * 100);
}
