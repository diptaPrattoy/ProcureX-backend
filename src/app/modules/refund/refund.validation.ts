import { z } from "zod";

const refundMoneySchema = z
  .number()
  .positive()
  .max(99999999999)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
    message: "Refund amount can have at most 2 decimal places",
  });

export const requestRefundSchema = z.object({
  amount: refundMoneySchema.optional(),
  reason: z.string().trim().min(10).max(1000),
});

export const rejectRefundSchema = z.object({
  note: z.string().trim().min(5).max(1000),
});

export const approveRefundSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const paymentRefundParamSchema = z.object({ paymentId: z.uuid() });
export const refundIdParamSchema = z.object({ refundId: z.uuid() });

export const refundListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z
    .enum(["REQUESTED", "APPROVED", "PROCESSING", "SUCCEEDED", "REJECTED", "FAILED", "CANCELLED"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type RequestRefundInput = z.infer<typeof requestRefundSchema>;
export type RefundListQuery = z.infer<typeof refundListQuerySchema>;
