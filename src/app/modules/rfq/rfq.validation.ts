import { z } from "zod";
import { isStripeSupportedCurrency } from "../payment/payment.domain.js";

const nullableOptionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

const currencySchema = z
  .string()
  .trim()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine(isStripeSupportedCurrency, "Currency is not supported for payments");

const moneySchema = z.coerce
  .number()
  .finite()
  .nonnegative()
  .max(999_999_999_999.99);
const quantitySchema = z.coerce
  .number()
  .finite()
  .positive()
  .max(999_999_999.999);

const rfqItemSchema = z.object({
  itemName: z.string().trim().min(2).max(180),
  description: nullableOptionalText(2000),
  specifications: z.record(z.string(), z.unknown()).optional(),
  quantity: quantitySchema,
  unit: z.string().trim().min(1).max(40),
});

const commonRfqFields = {
  categoryId: z.uuid(),
  title: z.string().trim().min(5).max(180),
  description: z.string().trim().min(10).max(5000),
  currency: currencySchema.default("USD"),
  budgetMin: moneySchema.optional().nullable(),
  budgetMax: moneySchema.optional().nullable(),
  submissionDeadline: z.iso.datetime({ offset: true }),
  expectedDeliveryDate: z.iso.date().optional().nullable(),
  deliveryAddressLine1: nullableOptionalText(180),
  deliveryAddressLine2: nullableOptionalText(180),
  deliveryCity: nullableOptionalText(100),
  deliveryState: nullableOptionalText(100),
  deliveryPostalCode: nullableOptionalText(30),
  deliveryCountry: nullableOptionalText(100),
};

const validateBudgetRange = (
  value: { budgetMin?: number | null; budgetMax?: number | null },
  ctx: z.RefinementCtx,
) => {
  if (
    value.budgetMin !== undefined &&
    value.budgetMin !== null &&
    value.budgetMax !== undefined &&
    value.budgetMax !== null &&
    value.budgetMin > value.budgetMax
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["budgetMax"],
      message: "budgetMax must be greater than or equal to budgetMin",
    });
  }
};

export const createRfqSchema = z
  .object({
    ...commonRfqFields,
    items: z.array(rfqItemSchema).min(1).max(50),
  })
  .superRefine(validateBudgetRange);

export const updateRfqSchema = z
  .object({
    categoryId: commonRfqFields.categoryId.optional(),
    title: commonRfqFields.title.optional(),
    description: commonRfqFields.description.optional(),
    currency: currencySchema.optional(),
    budgetMin: moneySchema.optional().nullable(),
    budgetMax: moneySchema.optional().nullable(),
    submissionDeadline: commonRfqFields.submissionDeadline.optional(),
    expectedDeliveryDate: commonRfqFields.expectedDeliveryDate,
    deliveryAddressLine1: commonRfqFields.deliveryAddressLine1,
    deliveryAddressLine2: commonRfqFields.deliveryAddressLine2,
    deliveryCity: commonRfqFields.deliveryCity,
    deliveryState: commonRfqFields.deliveryState,
    deliveryPostalCode: commonRfqFields.deliveryPostalCode,
    deliveryCountry: commonRfqFields.deliveryCountry,
    items: z.array(rfqItemSchema).min(1).max(50).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one RFQ field must be provided",
  })
  .superRefine(validateBudgetRange);

export const rfqIdParamSchema = z.object({ rfqId: z.uuid() });

const baseRfqListQuery = {
  search: z.string().trim().min(1).max(120).optional(),
  categoryId: z.uuid().optional(),
  currency: currencySchema.optional(),
  city: z.string().trim().min(1).max(100).optional(),
  country: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  sortBy: z
    .enum(["createdAt", "submissionDeadline", "budgetMax"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
};

export const myRfqListQuerySchema = z.object({
  ...baseRfqListQuery,
  status: z
    .enum([
      "DRAFT",
      "OPEN",
      "EVALUATING",
      "AWARDED",
      "CLOSED",
      "CANCELLED",
      "EXPIRED",
    ])
    .optional(),
});

export const openRfqListQuerySchema = z.object(baseRfqListQuery);

export type CreateRfqInput = z.infer<typeof createRfqSchema>;
export type UpdateRfqInput = z.infer<typeof updateRfqSchema>;
export type MyRfqListQuery = z.infer<typeof myRfqListQuerySchema>;
export type OpenRfqListQuery = z.infer<typeof openRfqListQuerySchema>;
