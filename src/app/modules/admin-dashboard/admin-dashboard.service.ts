import { prisma } from "../../../lib/prisma.js";
import { env } from "../../config/env.js";
import { CacheService } from "../cache/cache.service.js";
import { buildCacheKey } from "../cache/cache.domain.js";
import {
  buildDailyTrendBuckets,
  buildFinancialCurrencySummary,
  countByKey,
  resolveDashboardRange,
  startOfUtcDay,
} from "./admin-dashboard.domain.js";
import type {
  DashboardRangeQuery,
  DashboardTrendQuery,
} from "./admin-dashboard.validation.js";

const getOverviewFromDatabase = async (query: DashboardRangeQuery) => {
  const now = new Date();
  const { from, to } = resolveDashboardRange(query, now);

  const [
    users,
    suppliers,
    rfqsCreated,
    quotationsSubmitted,
    purchaseOrdersIssued,
    invoicesSubmitted,
    successfulPayments,
    refundRequests,
    disputesOpened,
    pendingSuppliers,
    openRfqs,
    invoicesAwaitingReview,
    paymentsInProgress,
    refundsAwaitingAction,
    activeDisputes,
    overdueInvoices,
    recentActivity,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { role: true, status: true },
    }),
    prisma.supplierProfile.findMany({
      where: { deletedAt: null },
      select: { verificationStatus: true },
    }),
    prisma.rfq.count({ where: { createdAt: { gte: from, lte: to }, deletedAt: null } }),
    prisma.quotation.count({
      where: { submittedAt: { gte: from, lte: to }, deletedAt: null },
    }),
    prisma.purchaseOrder.count({ where: { issuedAt: { gte: from, lte: to } } }),
    prisma.invoice.count({ where: { submittedAt: { gte: from, lte: to } } }),
    prisma.payment.count({
      where: {
        status: { in: ["SUCCEEDED", "REFUNDED"] },
        completedAt: { gte: from, lte: to },
      },
    }),
    prisma.refund.count({ where: { requestedAt: { gte: from, lte: to } } }),
    prisma.dispute.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.supplierProfile.count({
      where: { verificationStatus: "PENDING", deletedAt: null },
    }),
    prisma.rfq.count({
      where: {
        status: "OPEN",
        submissionDeadline: { gt: now },
        deletedAt: null,
      },
    }),
    prisma.invoice.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    }),
    prisma.payment.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.refund.count({
      where: { status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } },
    }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    prisma.invoice.count({
      where: {
        dueDate: { lt: now },
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PAYMENT_PENDING"] },
      },
    }),
    prisma.auditLog.findMany({
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    range: { from, to },
    users: {
      total: users.length,
      byRole: countByKey(users, "role"),
      byStatus: countByKey(users, "status"),
    },
    suppliers: {
      total: suppliers.length,
      byVerificationStatus: countByKey(suppliers, "verificationStatus"),
    },
    periodActivity: {
      rfqsCreated,
      quotationsSubmitted,
      purchaseOrdersIssued,
      invoicesSubmitted,
      successfulPayments,
      refundRequests,
      disputesOpened,
    },
    backlog: {
      suppliersPendingVerification: pendingSuppliers,
      openRfqs,
      invoicesAwaitingReview,
      paymentsInProgress,
      refundsAwaitingAction,
      activeDisputes,
      overdueInvoices,
    },
    recentActivity,
  };
};

const getFinancialsFromDatabase = async (query: DashboardRangeQuery) => {
  const { from, to } = resolveDashboardRange(query);

  const [grossRows, refundRows, outstandingRows] = await Promise.all([
    prisma.payment.groupBy({
      by: ["currency"],
      where: {
        status: { in: ["SUCCEEDED", "REFUNDED"] },
        completedAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.refund.groupBy({
      by: ["currency"],
      where: {
        status: "SUCCEEDED",
        completedAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.invoice.groupBy({
      by: ["currency"],
      where: { status: { in: ["APPROVED", "PAYMENT_PENDING"] } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  const gross = grossRows.map((row) => ({
    currency: row.currency,
    amount: row._sum.amount,
    count: row._count._all,
  }));
  const refunds = refundRows.map((row) => ({
    currency: row.currency,
    amount: row._sum.amount,
    count: row._count._all,
  }));
  const outstanding = outstandingRows.map((row) => ({
    currency: row.currency,
    amount: row._sum.totalAmount,
    count: row._count._all,
  }));

  return {
    range: { from, to },
    note:
      "Gross payments and refunds use the selected period; outstanding approved invoices are a current snapshot. Amounts are never combined across currencies.",
    currencies: buildFinancialCurrencySummary(gross, refunds, outstanding),
  };
};

const getTrendsFromDatabase = async (query: DashboardTrendQuery) => {
  const now = new Date();
  const end = new Date(startOfUtcDay(now).getTime() + 24 * 60 * 60 * 1000 - 1);
  const start = new Date(startOfUtcDay(now).getTime() - (query.days - 1) * 24 * 60 * 60 * 1000);

  const [rfqs, quotations, purchaseOrders, invoices, payments, refunds, disputes] =
    await Promise.all([
      prisma.rfq.findMany({
        where: { createdAt: { gte: start, lte: end }, deletedAt: null },
        select: { createdAt: true },
      }),
      prisma.quotation.findMany({
        where: { submittedAt: { gte: start, lte: end }, deletedAt: null },
        select: { submittedAt: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { issuedAt: { gte: start, lte: end } },
        select: { issuedAt: true },
      }),
      prisma.invoice.findMany({
        where: { submittedAt: { gte: start, lte: end } },
        select: { submittedAt: true },
      }),
      prisma.payment.findMany({
        where: {
          status: { in: ["SUCCEEDED", "REFUNDED"] },
          completedAt: { gte: start, lte: end },
        },
        select: { completedAt: true },
      }),
      prisma.refund.findMany({
        where: { requestedAt: { gte: start, lte: end } },
        select: { requestedAt: true },
      }),
      prisma.dispute.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true },
      }),
    ]);

  const completedPaymentDates = payments
    .map((row) => row.completedAt)
    .filter((value): value is Date => value instanceof Date);

  return {
    timezone: "UTC",
    days: query.days,
    from: start,
    to: end,
    buckets: buildDailyTrendBuckets(query.days, now, {
      rfqs: rfqs.map((row) => row.createdAt),
      quotations: quotations.map((row) => row.submittedAt),
      purchaseOrders: purchaseOrders.map((row) => row.issuedAt),
      invoices: invoices.map((row) => row.submittedAt),
      successfulPayments: completedPaymentDates,
      refundRequests: refunds.map((row) => row.requestedAt),
      disputes: disputes.map((row) => row.createdAt),
    }),
  };
};

const getOverview = async (query: DashboardRangeQuery) =>
  CacheService.remember(
    buildCacheKey("admin-dashboard:overview", query),
    env.CACHE_ANALYTICS_TTL_SECONDS,
    () => getOverviewFromDatabase(query),
  );

const getFinancials = async (query: DashboardRangeQuery) =>
  CacheService.remember(
    buildCacheKey("admin-dashboard:financials", query),
    env.CACHE_ANALYTICS_TTL_SECONDS,
    () => getFinancialsFromDatabase(query),
  );

const getTrends = async (query: DashboardTrendQuery) =>
  CacheService.remember(
    buildCacheKey("admin-dashboard:trends", query),
    env.CACHE_ANALYTICS_TTL_SECONDS,
    () => getTrendsFromDatabase(query),
  );

export const AdminDashboardService = {
  getOverview,
  getFinancials,
  getTrends,
};
