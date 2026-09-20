import type { Prisma } from "../../../generated/prisma/client";

export type AuditContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type CreateAuditLogInput = AuditContext & {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

type AuditDbClient = Pick<Prisma.TransactionClient, "auditLog">;

export const AuditService = {
  create(db: AuditDbClient, input: CreateAuditLogInput) {
    return db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  },
};
