import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { notificationReadFilter } from "./notification.domain.js";
import type { NotificationListQuery } from "./notification.validation.js";

const listMine = async (userId: string, query: NotificationListQuery) => {
  const readAt = notificationReadFilter(query.read);
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(readAt !== undefined ? { readAt } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { message: { contains: query.search, mode: "insensitive" } },
            { type: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

const unreadCount = async (userId: string) => {
  const count = await prisma.notification.count({
    where: { userId, readAt: null },
  });

  return { count };
};

const markRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    throw new AppError(404, "Notification not found");
  }

  if (notification.readAt) return notification;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
};

const markAllRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  return { updatedCount: result.count };
};

export const NotificationService = {
  listMine,
  unreadCount,
  markRead,
  markAllRead,
};
