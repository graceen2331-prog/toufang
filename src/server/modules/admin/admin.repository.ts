import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantCtx } from "@/server/modules/brand/brand.repository";

export const adminRepository = {
  async listMemberships(ctx: TenantCtx) {
    return prisma.membership.findMany({
      where: { tenantId: ctx.orgId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, name: true, status: true, createdAt: true } },
        role: { select: { id: true, key: true, name: true, permissions: true, isSystem: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async listRoles(ctx: TenantCtx) {
    return prisma.role.findMany({
      where: { tenantId: ctx.orgId, deletedAt: null },
      orderBy: [{ isSystem: "desc" }, { key: "asc" }],
    });
  },

  async findRoleByKey(ctx: TenantCtx, key: string) {
    return prisma.role.findFirst({ where: { tenantId: ctx.orgId, key, deletedAt: null } });
  },

  async updateMembership(ctx: TenantCtx, userId: string, data: Prisma.MembershipUncheckedUpdateInput) {
    await prisma.membership.updateMany({
      where: { tenantId: ctx.orgId, userId, deletedAt: null },
      data,
    });
    return prisma.membership.findFirst({
      where: { tenantId: ctx.orgId, userId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, name: true, status: true, createdAt: true } },
        role: { select: { id: true, key: true, name: true, permissions: true, isSystem: true } },
      },
    });
  },

  async getOrganization(ctx: TenantCtx) {
    return prisma.organization.findFirst({ where: { id: ctx.orgId, deletedAt: null } });
  },

  async updateOrganization(ctx: TenantCtx, data: Prisma.OrganizationUpdateInput) {
    return prisma.organization.update({ where: { id: ctx.orgId }, data });
  },

  async updateUser(ctx: TenantCtx, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id: ctx.userId ?? "" }, data });
  },

  async getUser(ctx: TenantCtx) {
    return prisma.user.findFirst({ where: { id: ctx.userId ?? "", deletedAt: null } });
  },
};
