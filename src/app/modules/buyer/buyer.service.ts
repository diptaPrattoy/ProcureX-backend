import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import type { UpdateBuyerProfileInput } from "./buyer.validation.js";

const buyerProfileSelect = {
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
  createdAt: true,
  updatedAt: true,
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

const getMyProfile = async (userId: string) => {
  const profile = await prisma.buyerProfile.findUnique({
    where: { userId },
    select: buyerProfileSelect,
  });

  if (!profile) {
    throw new AppError(404, "Buyer profile not found");
  }

  return profile;
};

const updateMyProfile = async (
  userId: string,
  input: UpdateBuyerProfileInput,
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

  const updated = await prisma.$transaction(async (tx) => {
    const profile = await tx.buyerProfile.findUnique({ where: { userId } });

    if (!profile) {
      throw new AppError(404, "Buyer profile not found");
    }

    if (
      firstName !== undefined ||
      lastName !== undefined ||
      phone !== undefined
    ) {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          phone: phone === "" ? null : phone,
        },
      });
    }

    const result = await tx.buyerProfile.update({
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
      },
      select: buyerProfileSelect,
    });

    await AuditService.create(tx, {
      actorId: userId,
      action: "BUYER_PROFILE_UPDATED",
      entityType: "BuyerProfile",
      entityId: profile.id,
      metadata: { updatedFields: Object.keys(input) },
      ...context,
    });

    return result;
  });

  return updated;
};

export const BuyerService = { getMyProfile, updateMyProfile };
