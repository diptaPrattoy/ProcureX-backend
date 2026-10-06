import { AppError } from "../../errors/AppError.js";

export type PayableInvoiceStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "CANCELLED";

export type PaymentLifecycleStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

const STRIPE_SUPPORTED_CURRENCIES = new Set(
  (
    "USD AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BIF BMD BND BOB BRL BSD BWP BYN BZD " +
    "CAD CDF CHF CLP CNY COP CRC CVE CZK DJF DKK DOP DZD EGP ETB EUR FJD FKP GBP GEL GIP GMD GNF " +
    "GTQ GYD HKD HNL HTG HUF IDR ILS INR ISK JMD JPY KES KGS KHR KMF KRW KYD KZT LAK LBP LKR " +
    "LRD LSL MAD MDL MGA MKD MMK MNT MOP MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD PAB " +
    "PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SEK SGD SHP SLE SOS SRD STD SZL THB " +
    "TJS TOP TRY TTD TWD TZS UAH UGX UYU UZS VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW"
  ).split(" "),
);

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

// Stripe represents these currencies with two minor digits for backwards compatibility,
// but only accepts whole major-unit amounts (for example, 5 UGX is sent as 500).
const WHOLE_MAJOR_TWO_DECIMAL_CURRENCIES = new Set(["ISK", "UGX"]);
const STRIPE_MAX_AMOUNT_MINOR_UNITS = 99_999_999;

const normalizeCurrency = (currency: string) => currency.trim().toUpperCase();

export const isStripeSupportedCurrency = (currency: string) =>
  STRIPE_SUPPORTED_CURRENCIES.has(normalizeCurrency(currency));

const currencyExponent = (currency: string) =>
  ZERO_DECIMAL_CURRENCIES.has(normalizeCurrency(currency)) ? 0 : 2;

const parseMinorUnits = (amount: string | number, currency: string): bigint => {
  const normalizedCurrency = normalizeCurrency(currency);
  const normalizedAmount =
    typeof amount === "number" ? String(amount) : amount.trim();

  if (!/^\d+(?:\.\d+)?$/.test(normalizedAmount)) {
    throw new AppError(422, "Invalid amount for payment provider");
  }

  const exponent = currencyExponent(normalizedCurrency);
  const [whole = "", fraction = ""] = normalizedAmount.split(".");

  if (exponent === 0) {
    if (/[1-9]/.test(fraction)) {
      throw new AppError(
        422,
        `${normalizedCurrency} payments cannot contain decimal amounts`,
      );
    }
    return BigInt(whole);
  }

  if (
    WHOLE_MAJOR_TWO_DECIMAL_CURRENCIES.has(normalizedCurrency) &&
    /[1-9]/.test(fraction)
  ) {
    throw new AppError(
      422,
      `${normalizedCurrency} payments must use whole currency amounts`,
    );
  }
  if (fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) {
    throw new AppError(422, "Amount has unsupported decimal precision");
  }

  const paddedFraction = `${fraction}00`.slice(0, 2);
  return BigInt(whole) * 100n + BigInt(paddedFraction);
};

export const assertInvoiceCanEnterPayment = (status: PayableInvoiceStatus) => {
  if (status !== "APPROVED" && status !== "PAYMENT_PENDING") {
    if (status === "PAID") {
      throw new AppError(409, "Invoice has already been paid");
    }
    throw new AppError(409, "Only an approved invoice can be paid");
  }
};

export const isReusableCheckoutStatus = (status: PaymentLifecycleStatus) =>
  status === "PENDING" || status === "PROCESSING";

export const isCheckoutSessionExpired = (
  expiresAt: number | undefined,
  nowMilliseconds = Date.now(),
) => expiresAt !== undefined && expiresAt * 1000 <= nowMilliseconds;

export const isTerminalPaymentStatus = (status: PaymentLifecycleStatus) =>
  status === "SUCCEEDED" ||
  status === "FAILED" ||
  status === "CANCELLED" ||
  status === "REFUNDED";

export const toCurrencyMinorUnits = (
  amount: string | number,
  currency: string,
): number => {
  const minorUnits = parseMinorUnits(amount, currency);
  if (minorUnits <= 0n || minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new AppError(422, "Amount is outside the supported payment range");
  }
  return Number(minorUnits);
};

export const toStripeMinorUnits = (
  amount: string | number,
  currency: string,
): number => {
  const normalizedCurrency = normalizeCurrency(currency);
  if (!isStripeSupportedCurrency(normalizedCurrency)) {
    throw new AppError(
      422,
      `${normalizedCurrency || "Currency"} is not supported for payments`,
    );
  }

  const minorUnits = toCurrencyMinorUnits(amount, normalizedCurrency);
  if (minorUnits > STRIPE_MAX_AMOUNT_MINOR_UNITS) {
    throw new AppError(422, "Amount exceeds the payment provider limit");
  }
  return minorUnits;
};

export const fromStripeMinorUnits = (
  amount: number,
  currency: string,
): string => {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new AppError(500, "Invalid amount from payment provider");
  }

  return currencyExponent(currency) === 0
    ? String(amount)
    : (amount / 100).toFixed(2);
};

export const formatCurrencyMinorUnits = (
  amount: number,
  currency: string,
): string => {
  if (!Number.isSafeInteger(amount)) {
    throw new AppError(500, "Invalid monetary aggregate");
  }
  return currencyExponent(currency) === 0
    ? String(amount)
    : (amount / 100).toFixed(2);
};
