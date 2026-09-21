import { z } from "zod";

const quantitySchema = z
  .number()
  .positive()
  .max(999999999)
  .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8, {
    message: "Quantity can have at most 3 decimal places",
  });

const moneySchema = z
  .number()
  .nonnegative()
  .max(99999999999)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
    message: "Money values can have at most 2 decimal places",
  });

const invoiceItemSchema = z.object({
  purchaseOrderItemId: z.uuid(),
  quantity: quantitySchema,
  description: z.string().trim().max(500).optional(),
});

export const createInvoiceSchema = z
  .object({
    invoiceNumber: z.string().trim().min(2).max(80),
    dueDate: z.iso.date(),
    taxAmount: moneySchema.default(0),
    notes: z.string().trim().max(1000).optional(),
    items: z.array(invoiceItemSchema).min(1).max(50),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      if (seen.has(item.purchaseOrderItemId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "purchaseOrderItemId"],
          message: "A purchase order item can appear only once",
        });
      }
      seen.add(item.purchaseOrderItemId);
    });
  });

export const purchaseOrderInvoiceParamSchema = z.object({ purchaseOrderId: z.uuid() });
export const invoiceIdParamSchema = z.object({ invoiceId: z.uuid() });

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z
    .enum([
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
      "PAYMENT_PENDING",
      "PAID",
      "CANCELLED",
    ])
    .optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(["submittedAt", "dueDate", "totalAmount", "updatedAt"]).default("submittedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;


export const rejectInvoiceSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export type RejectInvoiceInput = z.infer<typeof rejectInvoiceSchema>;
