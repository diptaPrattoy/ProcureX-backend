import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { env } from "../../config/env.js";
import { CacheService } from "../cache/cache.service.js";
import { AppError } from "../../errors/AppError.js";
import { AuditService, type AuditContext } from "../audit/audit.service.js";
import type {
  AdminSupplierListQuery,
  SetSupplierCategoriesInput,
  SupplierListQuery,
  SupplierVerificationInput,
  UpdateSupplierProfileInput,
} from "./supplier.validation.js";

const categorySelect = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const;

const privateSupplierSelect = {
  id: true,
  companyName: true,
  legalName: true,
  businessRegistrationNo: true,
  taxId: true,
  website: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  verificationStatus: true,
  verificationNote: true,
  deletedAt: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
  categories: { select: categorySelect },
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
      emailVerifiedAt: true,
    },
  },
} as const;

const publicSupplierSelect = {
  id: true,
  companyName: true,
  legalName: true,
  website: true,
  city: true,
  state: true,
  country: true,
  verificationStatus: true,
  verifiedAt: true,
  createdAt: true,
  categories: { select: categorySelect },
  user: {
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
} as const;

const unwrapCategories = <T extends { categories: Array<{ category: unknown }> }>(supplier: T) => ({
  ...supplier,
  categories: supplier.categories.map((entry) => entry.category),
});

const getMyProfile = async (userId: string) => {
  const profile = await prisma.supplierProfile.findUnique({
    where: { userId },
    select: privateSupplierSelect,
  });

  if (!profile || profile.deletedAt) {
    throw new AppError(404, "Supplier profile not found");
  }

  return unwrapCategories(profile);
};

const updateMyProfile = async (
  userId: string,
  input: UpdateSupplierProfileInput,
  context: AuditContext,
) => {
  const {
    firstName,
    lastName,
    phone,
    companyName,
    legalName,
    businessRegistrationNo,
    taxId,
    website,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
  } = input;

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.supplierProfile.findUnique({ where: { userId } });
    if (!current || current.deletedAt) {
      throw new AppError(404, "Supplier profile not found");
    }

    if (firstName !== undefined || lastName !== undefined || phone !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { firstName, lastName, phone: phone === "" ? null : phone },
      });
    }

    const legalIdentityChanged =
      current.verificationStatus === "VERIFIED" &&
      ((legalName !== undefined && legalName !== current.legalName) ||
        (businessRegistrationNo !== undefined &&
          businessRegistrationNo !== current.businessRegistrationNo) ||
        (taxId !== undefined && taxId !== current.taxId));

    const updated = await tx.supplierProfile.update({
      where: { userId },
      data: {
        companyName,
        legalName,
        businessRegistrationNo,
        taxId,
        website: website === "" ? null : website,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        ...(legalIdentityChanged
          ? {
              verificationStatus: "PENDING" as const,
              verificationNote: "Re-verification required after legal identity details changed",
              verifiedAt: null,
              verifiedById: null,
            }
          : {}),
      },
      select: privateSupplierSelect,
    });

    await AuditService.create(tx, {
      actorId: userId,
      action: "SUPPLIER_PROFILE_UPDATED",
      entityType: "SupplierProfile",
      entityId: current.id,
      metadata: {
        updatedFields: Object.keys(input),
        verificationReset: legalIdentityChanged,
      },
      ...context,
    });

    return unwrapCategories(updated);
  });

  await CacheService.bumpNamespace("supplier-directory");
  return result;
};

const setMyCategories = async (
  userId: string,
  input: SetSupplierCategoriesInput,
  context: AuditContext,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplierProfile.findUnique({ where: { userId } });
    if (!supplier || supplier.deletedAt) {
      throw new AppError(404, "Supplier profile not found");
    }

    const categories = await tx.category.findMany({
      where: {
        id: { in: input.categoryIds },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true, slug: true },
    });

    if (categories.length !== input.categoryIds.length) {
      const foundIds = new Set(categories.map((category) => category.id));
      const invalidIds = input.categoryIds.filter((id) => !foundIds.has(id));
      throw new AppError(400, "One or more categories are invalid or inactive", [
        { invalidCategoryIds: invalidIds },
      ]);
    }

    await tx.supplierCategory.deleteMany({ where: { supplierProfileId: supplier.id } });
    await tx.supplierCategory.createMany({
      data: input.categoryIds.map((categoryId) => ({
        supplierProfileId: supplier.id,
        categoryId,
      })),
    });

    await AuditService.create(tx, {
      actorId: userId,
      action: "SUPPLIER_CATEGORIES_UPDATED",
      entityType: "SupplierProfile",
      entityId: supplier.id,
      metadata: { categoryIds: input.categoryIds },
      ...context,
    });

    return categories.sort((a, b) => a.name.localeCompare(b.name));
  });

  await CacheService.bumpNamespace("supplier-directory");
  return result;
};

const listVerifiedFromDatabase = async (query: SupplierListQuery) => {
  const where: Prisma.SupplierProfileWhereInput = {
    verificationStatus: "VERIFIED",
    deletedAt: null,
    user: { status: "ACTIVE", deletedAt: null },
    ...(query.search
      ? {
          OR: [
            { companyName: { contains: query.search, mode: "insensitive" } },
            { legalName: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
    ...(query.country ? { country: { equals: query.country, mode: "insensitive" } } : {}),
    ...(query.category
      ? {
          categories: {
            some: {
              category: {
                isActive: true,
                deletedAt: null,
                OR: [
                  { slug: query.category.toLowerCase() },
                  { name: { equals: query.category, mode: "insensitive" } },
                ],
              },
            },
          },
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.supplierProfile.findMany({
      where,
      select: publicSupplierSelect,
      orderBy: [{ verifiedAt: "desc" }, { companyName: "asc" }],
      skip,
      take: query.limit,
    }),
    prisma.supplierProfile.count({ where }),
  ]);

  return {
    items: items.map(unwrapCategories),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

const listVerified = async (query: SupplierListQuery) =>
  CacheService.rememberVersioned(
    "supplier-directory",
    { type: "list", ...query },
    env.CACHE_SUPPLIER_TTL_SECONDS,
    () => listVerifiedFromDatabase(query),
  );

const getVerifiedByIdFromDatabase = async (supplierId: string) => {
  const supplier = await prisma.supplierProfile.findFirst({
    where: {
      id: supplierId,
      verificationStatus: "VERIFIED",
      deletedAt: null,
      user: { status: "ACTIVE", deletedAt: null },
    },
    select: publicSupplierSelect,
  });

  if (!supplier) {
    throw new AppError(404, "Verified supplier not found");
  }

  return unwrapCategories(supplier);
};

const getVerifiedById = async (supplierId: string) =>
  CacheService.rememberVersioned(
    "supplier-directory",
    { type: "detail", supplierId },
    env.CACHE_SUPPLIER_TTL_SECONDS,
    () => getVerifiedByIdFromDatabase(supplierId),
  );

const listForAdmin = async (query: AdminSupplierListQuery) => {
  const where: Prisma.SupplierProfileWhereInput = {
    deletedAt: null,
    ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
    ...(query.search
      ? {
          OR: [
            { companyName: { contains: query.search, mode: "insensitive" } },
            { legalName: { contains: query.search, mode: "insensitive" } },
            { user: { email: { contains: query.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.supplierProfile.findMany({
      where,
      select: privateSupplierSelect,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.supplierProfile.count({ where }),
  ]);

  return {
    items: items.map(unwrapCategories),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

const updateVerification = async (
  adminId: string,
  supplierId: string,
  input: SupplierVerificationInput,
  context: AuditContext,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplierProfile.findUnique({
      where: { id: supplierId },
      include: {
        user: { select: { id: true, emailVerifiedAt: true, status: true, deletedAt: true } },
        categories: { select: { categoryId: true } },
      },
    });

    if (!supplier || supplier.deletedAt || supplier.user.deletedAt) {
      throw new AppError(404, "Supplier profile not found");
    }

    if (supplier.user.status !== "ACTIVE") {
      throw new AppError(400, "Supplier account must be active before verification");
    }

    if (input.status === "VERIFIED") {
      if (!supplier.user.emailVerifiedAt) {
        throw new AppError(400, "Supplier must verify their email before approval");
      }
      if (!supplier.businessRegistrationNo) {
        throw new AppError(400, "Supplier business registration number is required before approval");
      }
      if (supplier.categories.length === 0) {
        throw new AppError(400, "Supplier must select at least one procurement category before approval");
      }
    }

    if (supplier.verificationStatus === input.status) {
      throw new AppError(409, `Supplier is already ${input.status.toLowerCase()}`);
    }

    const updated = await tx.supplierProfile.update({
      where: { id: supplierId },
      data: {
        verificationStatus: input.status,
        verificationNote: input.note ?? null,
        verifiedAt: input.status === "VERIFIED" ? new Date() : null,
        verifiedById: adminId,
      },
      select: privateSupplierSelect,
    });

    await AuditService.create(tx, {
      actorId: adminId,
      action: input.status === "VERIFIED" ? "SUPPLIER_VERIFIED" : "SUPPLIER_REJECTED",
      entityType: "SupplierProfile",
      entityId: supplierId,
      metadata: {
        supplierUserId: supplier.user.id,
        note: input.note ?? null,
      },
      ...context,
    });

    return unwrapCategories(updated);
  });

  await CacheService.bumpNamespace("supplier-directory");
  return result;
};

export const SupplierService = {
  getMyProfile,
  updateMyProfile,
  setMyCategories,
  listVerified,
  getVerifiedById,
  listForAdmin,
  updateVerification,
};
