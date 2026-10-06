import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import type {
  CreateRfqInput,
  MyRfqListQuery,
  OpenRfqListQuery,
  UpdateRfqInput,
} from "./rfq.validation.js";

const nextVersionTimestamp = (current: Date, now = new Date()) =>
  new Date(Math.max(now.getTime(), current.getTime() + 1));

const rfqDetailSelect = {
  id: true,
  title: true,
  description: true,
  currency: true,
  budgetMin: true,
  budgetMax: true,
  submissionDeadline: true,
  expectedDeliveryDate: true,
  deliveryAddressLine1: true,
  deliveryAddressLine2: true,
  deliveryCity: true,
  deliveryState: true,
  deliveryPostalCode: true,
  deliveryCountry: true,
  status: true,
  publishedAt: true,
  awardedAt: true,
  closedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  buyer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      buyerProfile: {
        select: {
          companyName: true,
          city: true,
          country: true,
        },
      },
    },
  },
  items: {
    select: {
      id: true,
      itemName: true,
      description: true,
      specifications: true,
      quantity: true,
      unit: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  _count: {
    select: {
      quotations: true,
    },
  },
} as const;

const rfqListSelect = {
  id: true,
  title: true,
  currency: true,
  budgetMin: true,
  budgetMax: true,
  submissionDeadline: true,
  expectedDeliveryDate: true,
  deliveryCity: true,
  deliveryCountry: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  category: {
    select: { id: true, name: true, slug: true },
  },
  buyer: {
    select: {
      buyerProfile: {
        select: { companyName: true },
      },
    },
  },
  _count: {
    select: { items: true, quotations: true },
  },
} as const;

const assertActiveCategory = async (
  db: Prisma.TransactionClient,
  categoryId: string,
) => {
  const category = await db.category.findFirst({
    where: {
      id: categoryId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!category) {
    throw new AppError(400, "Procurement category is invalid or inactive");
  }
};

const assertDates = (
  submissionDeadline: Date,
  expectedDeliveryDate?: Date | null,
) => {
  if (submissionDeadline <= new Date()) {
    throw new AppError(400, "Submission deadline must be in the future");
  }

  if (expectedDeliveryDate) {
    const deadlineDate = new Date(submissionDeadline);
    deadlineDate.setUTCHours(0, 0, 0, 0);

    if (expectedDeliveryDate < deadlineDate) {
      throw new AppError(
        400,
        "Expected delivery date cannot be before the submission deadline",
      );
    }
  }
};

const resolveBudgetRange = (
  current: { budgetMin: unknown | null; budgetMax: unknown | null },
  input: UpdateRfqInput,
) => {
  const nextMin =
    input.budgetMin === undefined ? current.budgetMin : input.budgetMin;
  const nextMax =
    input.budgetMax === undefined ? current.budgetMax : input.budgetMax;

  if (
    nextMin !== null &&
    nextMax !== null &&
    Number(nextMin) > Number(nextMax)
  ) {
    throw new AppError(
      400,
      "budgetMax must be greater than or equal to budgetMin",
    );
  }
};

const createDraft = async (
  buyerId: string,
  input: CreateRfqInput,
  context: AuditContext,
) => {
  const submissionDeadline = new Date(input.submissionDeadline);
  const expectedDeliveryDate = input.expectedDeliveryDate
    ? new Date(`${input.expectedDeliveryDate}T00:00:00.000Z`)
    : null;

  assertDates(submissionDeadline, expectedDeliveryDate);

  return prisma.$transaction(async (tx) => {
    await assertActiveCategory(tx, input.categoryId);

    const buyer = await tx.user.findFirst({
      where: { id: buyerId, role: "BUYER", status: "ACTIVE", deletedAt: null },
      select: { id: true },
    });
    if (!buyer) {
      throw new AppError(404, "Buyer account not found");
    }

    const rfq = await tx.rfq.create({
      data: {
        buyerId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        currency: input.currency,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        submissionDeadline,
        expectedDeliveryDate,
        deliveryAddressLine1: input.deliveryAddressLine1,
        deliveryAddressLine2: input.deliveryAddressLine2,
        deliveryCity: input.deliveryCity,
        deliveryState: input.deliveryState,
        deliveryPostalCode: input.deliveryPostalCode,
        deliveryCountry: input.deliveryCountry,
        items: {
          create: input.items.map((item) => ({
            itemName: item.itemName,
            description: item.description,
            specifications: item.specifications as
              | Prisma.InputJsonValue
              | undefined,
            quantity: item.quantity,
            unit: item.unit,
          })),
        },
      },
      select: rfqDetailSelect,
    });

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "RFQ_DRAFT_CREATED",
      entityType: "Rfq",
      entityId: rfq.id,
      metadata: {
        categoryId: input.categoryId,
        itemCount: input.items.length,
        currency: input.currency,
      },
      ...context,
    });

    return rfq;
  });
};

const updateDraft = async (
  buyerId: string,
  rfqId: string,
  input: UpdateRfqInput,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const current = await tx.rfq.findFirst({
      where: { id: rfqId, buyerId, deletedAt: null },
      select: {
        id: true,
        status: true,
        categoryId: true,
        budgetMin: true,
        budgetMax: true,
        submissionDeadline: true,
        expectedDeliveryDate: true,
        updatedAt: true,
      },
    });

    if (!current) {
      throw new AppError(404, "RFQ not found");
    }
    if (current.status !== "DRAFT") {
      throw new AppError(409, "Only draft RFQs can be edited");
    }

    if (input.categoryId && input.categoryId !== current.categoryId) {
      await assertActiveCategory(tx, input.categoryId);
    }

    resolveBudgetRange(current, input);

    const submissionDeadline = input.submissionDeadline
      ? new Date(input.submissionDeadline)
      : current.submissionDeadline;
    const expectedDeliveryDate =
      input.expectedDeliveryDate === undefined
        ? current.expectedDeliveryDate
        : input.expectedDeliveryDate
          ? new Date(`${input.expectedDeliveryDate}T00:00:00.000Z`)
          : null;

    assertDates(submissionDeadline, expectedDeliveryDate);

    const claimed = await tx.rfq.updateMany({
      where: {
        id: rfqId,
        buyerId,
        status: "DRAFT",
        deletedAt: null,
        updatedAt: current.updatedAt,
      },
      data: {
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        currency: input.currency,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        submissionDeadline: input.submissionDeadline
          ? submissionDeadline
          : undefined,
        expectedDeliveryDate:
          input.expectedDeliveryDate === undefined
            ? undefined
            : expectedDeliveryDate,
        deliveryAddressLine1: input.deliveryAddressLine1,
        deliveryAddressLine2: input.deliveryAddressLine2,
        deliveryCity: input.deliveryCity,
        deliveryState: input.deliveryState,
        deliveryPostalCode: input.deliveryPostalCode,
        deliveryCountry: input.deliveryCountry,
        updatedAt: nextVersionTimestamp(current.updatedAt),
      },
    });
    if (claimed.count !== 1) {
      throw new AppError(409, "RFQ state changed; retry the request");
    }

    if (input.items) {
      await tx.rfqItem.deleteMany({ where: { rfqId } });
      await tx.rfqItem.createMany({
        data: input.items.map((item) => ({
          rfqId,
          itemName: item.itemName,
          description: item.description,
          specifications: item.specifications as
            | Prisma.InputJsonValue
            | undefined,
          quantity: item.quantity,
          unit: item.unit,
        })),
      });
    }

    const updated = await tx.rfq.findUniqueOrThrow({
      where: { id: rfqId },
      select: rfqDetailSelect,
    });

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "RFQ_DRAFT_UPDATED",
      entityType: "Rfq",
      entityId: rfqId,
      metadata: {
        updatedFields: Object.keys(input),
        itemsReplaced: Boolean(input.items),
      },
      ...context,
    });

    return updated;
  });
};

const publish = async (
  buyerId: string,
  rfqId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findFirst({
      where: { id: rfqId, buyerId, deletedAt: null },
      include: {
        buyer: { select: { emailVerifiedAt: true } },
        category: { select: { isActive: true, deletedAt: true } },
        items: { select: { id: true } },
      },
    });

    if (!rfq) {
      throw new AppError(404, "RFQ not found");
    }
    if (rfq.status !== "DRAFT") {
      throw new AppError(409, "Only draft RFQs can be published");
    }
    if (!rfq.buyer.emailVerifiedAt) {
      throw new AppError(403, "Verify your email before publishing an RFQ");
    }
    if (!rfq.category.isActive || rfq.category.deletedAt) {
      throw new AppError(400, "The RFQ category is no longer active");
    }
    if (rfq.items.length === 0) {
      throw new AppError(400, "An RFQ must contain at least one line item");
    }

    assertDates(rfq.submissionDeadline, rfq.expectedDeliveryDate);

    const publishedAt = new Date();
    const versionAt = nextVersionTimestamp(rfq.updatedAt, publishedAt);
    const claimed = await tx.rfq.updateMany({
      where: {
        id: rfqId,
        buyerId,
        status: "DRAFT",
        deletedAt: null,
        updatedAt: rfq.updatedAt,
      },
      data: {
        status: "OPEN",
        publishedAt,
        updatedAt: versionAt,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError(409, "RFQ state changed; retry the request");
    }

    const updated = await tx.rfq.findUniqueOrThrow({
      where: { id: rfqId },
      select: rfqDetailSelect,
    });

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "RFQ_PUBLISHED",
      entityType: "Rfq",
      entityId: rfqId,
      metadata: { submissionDeadline: rfq.submissionDeadline.toISOString() },
      ...context,
    });

    return updated;
  });
};

const cancel = async (
  buyerId: string,
  rfqId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findFirst({
      where: { id: rfqId, buyerId, deletedAt: null },
      select: { id: true, status: true, updatedAt: true },
    });

    if (!rfq) {
      throw new AppError(404, "RFQ not found");
    }
    if (rfq.status !== "DRAFT" && rfq.status !== "OPEN") {
      throw new AppError(409, "This RFQ can no longer be cancelled");
    }

    const cancelledAt = new Date();
    const versionAt = nextVersionTimestamp(rfq.updatedAt, cancelledAt);
    const claimed = await tx.rfq.updateMany({
      where: {
        id: rfqId,
        buyerId,
        status: rfq.status,
        deletedAt: null,
        updatedAt: rfq.updatedAt,
      },
      data: {
        status: "CANCELLED",
        cancelledAt,
        updatedAt: versionAt,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError(409, "RFQ state changed; retry the request");
    }

    const updated = await tx.rfq.findUniqueOrThrow({
      where: { id: rfqId },
      select: rfqDetailSelect,
    });

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "RFQ_CANCELLED",
      entityType: "Rfq",
      entityId: rfqId,
      metadata: { previousStatus: rfq.status },
      ...context,
    });

    return updated;
  });
};

const softDelete = async (
  buyerId: string,
  rfqId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findFirst({
      where: { id: rfqId, buyerId, deletedAt: null },
      select: { id: true, status: true, updatedAt: true },
    });

    if (!rfq) {
      throw new AppError(404, "RFQ not found");
    }
    if (rfq.status !== "DRAFT" && rfq.status !== "CANCELLED") {
      throw new AppError(409, "Only draft or cancelled RFQs can be deleted");
    }

    const deletedAt = new Date();
    const versionAt = nextVersionTimestamp(rfq.updatedAt, deletedAt);
    const claimed = await tx.rfq.updateMany({
      where: {
        id: rfqId,
        buyerId,
        status: rfq.status,
        deletedAt: null,
        updatedAt: rfq.updatedAt,
      },
      data: { deletedAt, updatedAt: versionAt },
    });
    if (claimed.count !== 1) {
      throw new AppError(409, "RFQ state changed; retry the request");
    }

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "RFQ_SOFT_DELETED",
      entityType: "Rfq",
      entityId: rfqId,
      metadata: { previousStatus: rfq.status },
      ...context,
    });

    return null;
  });
};

const getMineById = async (buyerId: string, rfqId: string) => {
  const rfq = await prisma.rfq.findFirst({
    where: { id: rfqId, buyerId, deletedAt: null },
    select: rfqDetailSelect,
  });

  if (!rfq) {
    throw new AppError(404, "RFQ not found");
  }

  return rfq;
};

const buildCommonListWhere = (
  query: MyRfqListQuery | OpenRfqListQuery,
): Prisma.RfqWhereInput => ({
  deletedAt: null,
  ...(query.search
    ? {
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
          {
            items: {
              some: {
                itemName: { contains: query.search, mode: "insensitive" },
              },
            },
          },
        ],
      }
    : {}),
  ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  ...(query.currency ? { currency: query.currency } : {}),
  ...(query.city
    ? { deliveryCity: { equals: query.city, mode: "insensitive" } }
    : {}),
  ...(query.country
    ? { deliveryCountry: { equals: query.country, mode: "insensitive" } }
    : {}),
});

const buildOrderBy = (
  sortBy: "createdAt" | "submissionDeadline" | "budgetMax",
  sortOrder: "asc" | "desc",
): Prisma.RfqOrderByWithRelationInput => {
  if (sortBy === "submissionDeadline") {
    return { submissionDeadline: sortOrder };
  }
  if (sortBy === "budgetMax") {
    return { budgetMax: sortOrder };
  }
  return { createdAt: sortOrder };
};

const listMine = async (buyerId: string, query: MyRfqListQuery) => {
  const where: Prisma.RfqWhereInput = {
    ...buildCommonListWhere(query),
    buyerId,
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.rfq.findMany({
      where,
      select: rfqListSelect,
      orderBy: buildOrderBy(query.sortBy, query.sortOrder),
      skip,
      take: query.limit,
    }),
    prisma.rfq.count({ where }),
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

const listOpen = async (query: OpenRfqListQuery) => {
  const where: Prisma.RfqWhereInput = {
    ...buildCommonListWhere(query),
    status: "OPEN",
    submissionDeadline: { gt: new Date() },
    category: { isActive: true, deletedAt: null },
    buyer: { status: "ACTIVE", deletedAt: null },
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.rfq.findMany({
      where,
      select: rfqListSelect,
      orderBy: buildOrderBy(query.sortBy, query.sortOrder),
      skip,
      take: query.limit,
    }),
    prisma.rfq.count({ where }),
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

const getOpenById = async (rfqId: string) => {
  const rfq = await prisma.rfq.findFirst({
    where: {
      id: rfqId,
      status: "OPEN",
      deletedAt: null,
      submissionDeadline: { gt: new Date() },
      category: { isActive: true, deletedAt: null },
      buyer: { status: "ACTIVE", deletedAt: null },
    },
    select: rfqDetailSelect,
  });

  if (!rfq) {
    throw new AppError(404, "Open RFQ not found");
  }

  return rfq;
};

export const RfqService = {
  createDraft,
  updateDraft,
  publish,
  cancel,
  softDelete,
  getMineById,
  listMine,
  listOpen,
  getOpenById,
};
