import { AppError } from "../../errors/AppError.js";

export type PurchaseOrderLifecycleStatus =
  | "ISSUED"
  | "ACCEPTED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "PARTIALLY_DELIVERED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type PurchaseOrderTransitionActor = "BUYER" | "SUPPLIER";
export type PurchaseOrderTransitionAction =
  | "ACCEPT"
  | "REJECT"
  | "START_FULFILLMENT"
  | "CANCEL";

export type PurchaseOrderTransitionState = {
  status: PurchaseOrderLifecycleStatus;
  actor: PurchaseOrderTransitionActor;
  action: PurchaseOrderTransitionAction;
};

type TransitionRule = {
  actor: PurchaseOrderTransitionActor;
  from: PurchaseOrderLifecycleStatus;
  to: PurchaseOrderLifecycleStatus;
};

const allowedTransitions: Record<
  PurchaseOrderTransitionAction,
  TransitionRule
> = {
  ACCEPT: { actor: "SUPPLIER", from: "ISSUED", to: "ACCEPTED" },
  REJECT: { actor: "SUPPLIER", from: "ISSUED", to: "REJECTED" },
  START_FULFILLMENT: { actor: "SUPPLIER", from: "ACCEPTED", to: "IN_PROGRESS" },
  CANCEL: { actor: "BUYER", from: "ISSUED", to: "CANCELLED" },
};

export const assertPurchaseOrderTransition = ({
  status,
  actor,
  action,
}: PurchaseOrderTransitionState): PurchaseOrderLifecycleStatus => {
  const rule = allowedTransitions[action];

  if (rule.actor !== actor) {
    throw new AppError(
      403,
      `Only the ${rule.actor.toLowerCase()} can perform this action`,
    );
  }
  if (status !== rule.from) {
    throw new AppError(
      409,
      `Purchase order must be ${rule.from} before it can transition to ${rule.to}`,
    );
  }

  return rule.to;
};
