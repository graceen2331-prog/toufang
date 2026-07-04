import { z } from "zod";

export const UserSettingsUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  locale: z.string().min(2).max(20).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});
export type UserSettingsUpdateInput = z.infer<typeof UserSettingsUpdateSchema>;

export interface UserSettingsDto {
  user: {
    id: string;
    email: string;
    name: string;
    locale: string;
    settings: Record<string, unknown>;
  };
  org: {
    id: string;
    name: string;
    slug: string;
  };
}
