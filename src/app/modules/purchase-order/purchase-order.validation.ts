import { z } from "zod";

export const purchaseOrderIdParamSchema = z.object({
  purchaseOrderId: z.uuid(),
});

export const purchaseOrderListQuerySchema = z.object({
  status: z
    .enum([
      "ISSUED",
      "ACCEPTED",
      "REJECTED",
      "IN_PROGRESS",
      "PARTIALLY_DELIVERED",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  sortBy: z.enum(["issuedAt", "totalAmount", "updatedAt"]).default("issuedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PurchaseOrderListQuery = z.infer<
  typeof purchaseOrderListQuerySchema
>;
