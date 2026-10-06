import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).optional().nullable();

export const updateSupplierProfileSchema = z
  .object({
    firstName: z.string().trim().min(2).max(60).optional(),
    lastName: z.string().trim().min(2).max(60).optional(),
    phone: optionalText(30),
    companyName: z.string().trim().min(2).max(160).optional(),
    legalName: optionalText(180),
    businessRegistrationNo: optionalText(100),
    taxId: optionalText(100),
    website: z.union([z.url(), z.literal(""), z.null()]).optional(),
    addressLine1: optionalText(180),
    addressLine2: optionalText(180),
    city: optionalText(100),
    state: optionalText(100),
    postalCode: optionalText(30),
    country: optionalText(100),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field must be provided",
  });

export const setSupplierCategoriesSchema = z.object({
  categoryIds: z
    .array(z.uuid())
    .min(1, "At least one procurement category is required")
    .max(10)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Category IDs must be unique",
    }),
});

export const supplierListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  country: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const adminSupplierListQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const supplierIdParamSchema = z.object({ supplierId: z.uuid() });

export const supplierVerificationSchema = z
  .object({
    status: z.enum(["VERIFIED", "REJECTED"]),
    note: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "REJECTED" && !value.note) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "A rejection note is required",
      });
    }
  });

export type UpdateSupplierProfileInput = z.infer<
  typeof updateSupplierProfileSchema
>;
export type SetSupplierCategoriesInput = z.infer<
  typeof setSupplierCategoriesSchema
>;
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;
export type AdminSupplierListQuery = z.infer<
  typeof adminSupplierListQuerySchema
>;
export type SupplierVerificationInput = z.infer<
  typeof supplierVerificationSchema
>;
