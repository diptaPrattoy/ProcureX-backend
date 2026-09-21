import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import type { AdminAuditQuery, MyActivityQuery } from "./activity.validation.js";

const buildWhere = (
  query: MyActivityQuery | AdminAuditQuery,
  actorId?: string,
): Prisma.AuditLogWhereInput => ({
  ...(actorId ? { actorId } : {}),
  ...(query.action ? { action: query.action } : {}),
  ...(query.entityType ? { entityType: query.entityType } : {}),
  ...(query.entityId ? { entityId: query.entityId } : {}),
  ...(query.from || query.to
    ? {
        createdAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      }
    : {}),
  ...(query.search
    ? {
        OR: [
          { action: { contains: query.search, mode: "insensitive" } },
          { entityType: { contains: query.search, mode: "insensitive" } },
          { entityId: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {}),
});

const paginationResult = async (
  where: Prisma.AuditLogWhereInput,
  page: number,
  limit: number,
  includeActor: boolean,
) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: includeActor
        ? {
            actor: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const listMine = async (userId: string, query: MyActivityQuery) =>
  paginationResult(buildWhere(query, userId), query.page, query.limit, false);

const listAdmin = async (query: AdminAuditQuery) => {
  const where = buildWhere(query, query.actorId);
  return paginationResult(where, query.page, query.limit, true);
};

const getAdminById = async (auditLogId: string) => {
  const auditLog = await prisma.auditLog.findUnique({
    where: { id: auditLogId },
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  if (!auditLog) throw new AppError(404, "Audit log not found");
  return auditLog;
};

export const ActivityService = {
  listMine,
  listAdmin,
  getAdminById,
};
