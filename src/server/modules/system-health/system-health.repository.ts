import "server-only";

import { prisma } from "@/server/db/client";
import { getBullConnection } from "@/server/jobs/queues";

export const systemHealthRepository = {
  async checkDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  },

  async checkRedis(): Promise<void> {
    await getBullConnection().ping();
  },
};
