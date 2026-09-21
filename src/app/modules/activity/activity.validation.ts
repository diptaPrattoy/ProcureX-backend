import { z } from "zod";

const baseAuditQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  entityType: z.string().trim().min(1).max(120).optional(),
  entityId: z.string().trim().min(1).max(180).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const validDateRange = (value: { from?: Date; to?: Date }) =>
  !value.from || !value.to || value.from <= value.to;

export const myActivityQuerySchema = baseAuditQuerySchema.refine(validDateRange, {
  message: "from must be earlier than or equal to to",
  path: ["from"],
});

export const adminAuditQuerySchema = baseAuditQuerySchema
  .extend({ actorId: z.uuid().optional() })
  .refine(validDateRange, {
    message: "from must be earlier than or equal to to",
    path: ["from"],
  });

export const auditLogIdParamSchema = z.object({
  auditLogId: z.uuid(),
});

export type MyActivityQuery = z.infer<typeof myActivityQuerySchema>;
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
