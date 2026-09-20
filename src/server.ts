import type { Server } from "node:http";
import { app } from "./app.js";
import { env } from "./app/config/env.js";
import { prisma } from "./lib/prisma.js";

let server: Server | undefined;

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();

    server = app.listen(env.PORT, () => {
      console.log(`ProcuraX API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
    });
  } catch (error) {
    console.error("Failed to start ProcuraX API", error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  }
};

const shutdown = async (signal: string): Promise<void> => {
  console.log(`${signal} received. Shutting down gracefully...`);

  if (server) {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });

    return;
  }

  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason);
  void shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
  void shutdown("uncaughtException");
});

void startServer();
