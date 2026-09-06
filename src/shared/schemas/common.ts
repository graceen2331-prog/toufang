// 通用 DTO 类型（前后端共用）

export interface StatusEventDto {
  id: string;
  field: string;
  from_value: string | null;
  to_value: string;
  actor_type: string;
  actor_name: string | null;
  reason: string | null;
  created_at: string;
}
