import { z } from "zod";

export const notificationListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  type: z.string().trim().min(1).max(100).optional(),
  read: z.enum(["ALL", "READ", "UNREAD"]).default("ALL"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.uuid(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
