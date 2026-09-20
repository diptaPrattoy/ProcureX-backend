import { z } from "zod";

export const categoryListQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
