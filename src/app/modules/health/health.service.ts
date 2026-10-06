import { prisma } from "../../../lib/prisma.js";
import { env } from "../../config/env.js";
import { CacheService } from "../cache/cache.service.js";

export const HealthService = {
  async getStatus() {
    await prisma.$queryRaw`SELECT 1`;

    return {
      service: "procurax-api",
      status: "ok",
      environment: env.NODE_ENV,
      database: "connected",
      cache: CacheService.status(),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },
};
