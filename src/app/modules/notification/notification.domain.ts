import type { Prisma } from "../../../generated/prisma/client";

export const notificationReadFilter = (
  read: "ALL" | "READ" | "UNREAD",
): Prisma.NotificationWhereInput["readAt"] | undefined => {
  if (read === "READ") return { not: null };
  if (read === "UNREAD") return null;
  return undefined;
};
