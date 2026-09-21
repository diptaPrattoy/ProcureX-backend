import { z } from "zod";

export const openDisputeSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(5000),
});

export const resolveDisputeSchema = z.object({
  resolution: z.string().trim().min(10).max(5000),
});

export const rejectDisputeSchema = z.object({
  resolution: z.string().trim().min(10).max(5000),
});

export const purchaseOrderDisputeParamSchema = z.object({ purchaseOrderId: z.uuid() });
export const invoiceDisputeParamSchema = z.object({ invoiceId: z.uuid() });
export const disputeIdParamSchema = z.object({ disputeId: z.uuid() });

export const disputeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"]).optional(),
  targetType: z.enum(["PURCHASE_ORDER", "INVOICE"]).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;
export type DisputeListQuery = z.infer<typeof disputeListQuerySchema>;
