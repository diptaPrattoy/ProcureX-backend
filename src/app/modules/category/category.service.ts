import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { env } from "../../config/env.js";
import { buildCacheKey } from "../cache/cache.domain.js";
import { CacheService } from "../cache/cache.service.js";
import type { CategoryListQuery } from "./category.validation.js";

const listFromDatabase = async (query: CategoryListQuery) => {
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

const list = async (query: CategoryListQuery) =>
  CacheService.remember(
    buildCacheKey("categories:list", query),
    env.CACHE_CATEGORY_TTL_SECONDS,
    () => listFromDatabase(query),
  );

export const CategoryService = { list };
