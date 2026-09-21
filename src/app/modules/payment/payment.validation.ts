import { z } from "zod";

export const invoicePaymentParamSchema = z.object({ invoiceId: z.uuid() });
export const paymentIdParamSchema = z.object({ paymentId: z.uuid() });

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z
    .enum(["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
