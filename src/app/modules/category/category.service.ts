import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma.js";
import type { CategoryListQuery } from "./category.validation.js";

const list = async (query: CategoryListQuery) => {
  const where: Prisma.CategoryWhereInput = {
    isActive: true,
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.category.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
      orderBy: { name: "asc" },
      skip,
      take: query.limit,
    }),
    prisma.category.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const CategoryService = { list };
