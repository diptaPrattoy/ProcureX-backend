import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).optional().nullable();

export const updateBuyerProfileSchema = z
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

export type UpdateBuyerProfileInput = z.infer<typeof updateBuyerProfileSchema>;
