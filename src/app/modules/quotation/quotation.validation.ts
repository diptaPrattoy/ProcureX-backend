import { z } from "zod";

const currencySchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), "Currency must be a 3-letter ISO-style code");

const moneySchema = z.coerce.number().finite().nonnegative().max(999_999_999_999.99);

const quotationItemSchema = z.object({
  rfqItemId: z.uuid(),
  unitPrice: moneySchema.positive(),
  notes: z.string().trim().min(1).max(1000).nullable().optional(),
});

const commonFields = {
  currency: currencySchema,
  taxAmount: moneySchema.default(0),
  deliveryDays: z.coerce.number().int().positive().max(3650),
  validUntil: z.iso.date(),
  terms: z.string().trim().min(1).max(5000).nullable().optional(),
  notes: z.string().trim().min(1).max(5000).nullable().optional(),
};

export const submitQuotationSchema = z.object({
  ...commonFields,
  items: z.array(quotationItemSchema).min(1).max(50),
});

export const updateQuotationSchema = z
  .object({
    currency: currencySchema.optional(),
    taxAmount: moneySchema.optional(),
    deliveryDays: commonFields.deliveryDays.optional(),
    validUntil: commonFields.validUntil.optional(),
    terms: commonFields.terms,
    notes: commonFields.notes,
    items: z.array(quotationItemSchema).min(1).max(50).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one quotation field must be provided",
  });

export const quotationIdParamSchema = z.object({ quotationId: z.uuid() });
export const quotationRfqIdParamSchema = z.object({ rfqId: z.uuid() });

export const myQuotationListQuerySchema = z.object({
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "AWARDED", "REJECTED", "WITHDRAWN", "EXPIRED"]).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  sortBy: z.enum(["submittedAt", "totalAmount", "validUntil"]).default("submittedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type SubmitQuotationInput = z.infer<typeof submitQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type MyQuotationListQuery = z.infer<typeof myQuotationListQuerySchema>;
