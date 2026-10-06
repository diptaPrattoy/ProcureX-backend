import { z } from "zod";

const rangeShape = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
};

const validRange = (value: { from?: Date; to?: Date }) =>
  !value.from || !value.to || value.from <= value.to;

export const dashboardRangeQuerySchema = z
  .object(rangeShape)
  .refine(validRange, {
    message: "from must be earlier than or equal to to",
    path: ["from"],
  });

export const dashboardTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
});

export type DashboardRangeQuery = z.infer<typeof dashboardRangeQuerySchema>;
export type DashboardTrendQuery = z.infer<typeof dashboardTrendQuerySchema>;
