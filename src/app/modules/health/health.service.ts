import { env } from "../../config/env.js";
import { prisma } from "../../../lib/prisma.js";

export const HealthService = {
  async getStatus() {
    await prisma.$queryRaw`SELECT 1`;

    return {
      service: "procurax-api",
      status: "ok",
      environment: env.NODE_ENV,
      database: "connected",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },
};
