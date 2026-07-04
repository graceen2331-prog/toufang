import { createApiHandler } from "@/server/api/handler";
import { addCreatorNote, listCreatorNotes } from "@/server/modules/creator/creator.service";
import { CreatorNoteSchema } from "@/shared/schemas/creator";

export const GET = createApiHandler({
  permission: "creator:read",
  handler: async (ctx) =>
    listCreatorNotes({ orgId: ctx.auth.orgId, userId: ctx.auth.userId }, ctx.params.id!),
});

export const POST = createApiHandler({
  permission: "creator:write",
  body: CreatorNoteSchema,
  audit: "creator.note_add",
  created: true,
  handler: async (ctx) => {
    await addCreatorNote(
      { orgId: ctx.auth.orgId, userId: ctx.auth.userId },
      ctx.params.id!,
      ctx.body.content,
    );
    ctx.setAuditEntity("creator", ctx.params.id!);
    return { created: true };
  },
});
