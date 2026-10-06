import { z } from "zod";

const quantitySchema = z
  .number()
  .nonnegative()
  .max(999999999)
  .refine((value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8, {
    message: "Quantity can have at most 3 decimal places",
  });

const receiptItemSchema = z.object({
  purchaseOrderItemId: z.uuid(),
  quantityReceived: quantitySchema.refine((value) => value > 0, {
    message: "Received quantity must be greater than zero",
  }),
  quantityAccepted: quantitySchema,
  quantityRejected: quantitySchema,
  notes: z.string().trim().max(500).optional(),
});

export const createGoodsReceiptSchema = z
  .object({
    notes: z.string().trim().max(1000).optional(),
    items: z.array(receiptItemSchema).min(1).max(50),
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

      const received = Math.round(item.quantityReceived * 1000);
      const accepted = Math.round(item.quantityAccepted * 1000);
      const rejected = Math.round(item.quantityRejected * 1000);
      if (accepted + rejected !== received) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index],
          message:
            "Accepted plus rejected quantity must equal received quantity",
        });
      }
    });
  });

export const purchaseOrderReceiptParamSchema = z.object({
  purchaseOrderId: z.uuid(),
});
export const goodsReceiptIdParamSchema = z.object({ goodsReceiptId: z.uuid() });

export const goodsReceiptListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;
export type GoodsReceiptListQuery = z.infer<typeof goodsReceiptListQuerySchema>;
