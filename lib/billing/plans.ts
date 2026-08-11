export type BillingPlanCode = "pro_monthly" | "pro_yearly";

export type BillingInterval = Readonly<{
  unit: "month" | "year";
  count: number;
}>;

export type BillingPlanBenefit = Readonly<{
  code:
    | "post_workout_analyses"
    | "coach_questions"
    | "quota_exchange"
    | "one_shot_ai_operations";
  label: string;
}>;

export type BillingPlanQuotas = Readonly<{
  resetInterval: BillingInterval;
  postWorkoutAnalyses: number;
  coachReplies: number;
  progressSummaries: number;
  oneShotAiOperations: number;
}>;

export type BillingPlan = Readonly<{
  code: BillingPlanCode;
  title: string;
  priceKopecks: number;
  currency: "RUB";
  interval: BillingInterval;
  benefits: readonly BillingPlanBenefit[];
  quotas: BillingPlanQuotas;
}>;

const PRO_BENEFITS = [
  {
    code: "post_workout_analyses",
    label: "15 AI-разборов завершённых тренировок в месяц",
  },
  {
    code: "coach_questions",
    label: "60 дополнительных вопросов AI-тренеру в месяц",
  },
  {
    code: "quota_exchange",
    label: "Обмен 20 вопросов на 10 дополнительных разборов",
  },
  {
    code: "one_shot_ai_operations",
    label: "Персональные планы и улучшение тренировочных шаблонов",
  },
] as const satisfies readonly BillingPlanBenefit[];

const PRO_MONTHLY_QUOTAS = {
  resetInterval: { unit: "month", count: 1 },
  postWorkoutAnalyses: 15,
  coachReplies: 60,
  progressSummaries: 20,
  oneShotAiOperations: 10,
} as const satisfies BillingPlanQuotas;

/**
 * Public billing catalogue. Prices are always integer kopecks; billing and
 * quota intervals are explicit so callers never need to infer plan behavior
 * from the plan code.
 */
export const BILLING_PLANS = {
  pro_monthly: {
    code: "pro_monthly",
    title: "Pro на месяц",
    priceKopecks: 29_000,
    currency: "RUB",
    interval: { unit: "month", count: 1 },
    benefits: PRO_BENEFITS,
    quotas: PRO_MONTHLY_QUOTAS,
  },
  pro_yearly: {
    code: "pro_yearly",
    title: "Pro на год",
    priceKopecks: 290_000,
    currency: "RUB",
    interval: { unit: "year", count: 1 },
    benefits: PRO_BENEFITS,
    // An annual subscription is billed yearly but its allowances reset monthly.
    quotas: PRO_MONTHLY_QUOTAS,
  },
} as const satisfies Record<BillingPlanCode, BillingPlan>;

export function isBillingPlanCode(value: unknown): value is BillingPlanCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(BILLING_PLANS, value)
  );
}

export function getBillingPlan(code: unknown): BillingPlan {
  if (!isBillingPlanCode(code)) {
    throw new Error(`Unknown billing plan: ${String(code)}`);
  }
  return BILLING_PLANS[code];
}

function assertValidDate(value: Date): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError("Expected a valid Date");
  }
}

function daysInUtcMonth(value: Date): number {
  const endOfMonth = new Date(value.getTime());
  endOfMonth.setUTCDate(1);
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
  endOfMonth.setUTCDate(0);
  return endOfMonth.getUTCDate();
}

/**
 * Advances a UTC calendar period without JavaScript's overflow surprises.
 *
 * A date already at the end of its month stays at the end of the target month:
 * Jan 31 → Feb 29 → Mar 31. UTC time-of-day and milliseconds are preserved.
 */
export function advanceUtcCalendarPeriod(
  start: Date,
  interval: BillingInterval,
): Date {
  assertValidDate(start);
  if (!Number.isSafeInteger(interval.count) || interval.count <= 0) {
    throw new RangeError("Billing interval count must be a positive integer");
  }

  const originalDay = start.getUTCDate();
  const preserveMonthEnd = originalDay === daysInUtcMonth(start);
  const result = new Date(start.getTime());

  // Setting day 1 first prevents May 31 + 1 month from overflowing into July.
  result.setUTCDate(1);
  if (interval.unit === "month") {
    result.setUTCMonth(result.getUTCMonth() + interval.count);
  } else if (interval.unit === "year") {
    result.setUTCFullYear(result.getUTCFullYear() + interval.count);
  } else {
    const exhaustive: never = interval.unit;
    throw new TypeError(`Unsupported billing interval: ${String(exhaustive)}`);
  }

  const targetMonthEnd = daysInUtcMonth(result);
  result.setUTCDate(
    preserveMonthEnd ? targetMonthEnd : Math.min(originalDay, targetMonthEnd),
  );
  return result;
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | null;

export type BillingAccessWindow = Readonly<{
  status: SubscriptionStatus;
  currentPeriodStart?: Date | string | number | null;
  currentPeriodEnd: Date | string | number | null;
}>;

export type ProBillingAccess = BillingAccessWindow &
  Readonly<{
    tier: "free" | "pro" | null;
  }>;

function dateInputToTimestamp(
  value: Date | string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Returns whether `at` belongs to the active access window. The period end is
 * exclusive, matching the usual [start, end) subscription representation.
 */
export function isAccessActive(
  access: BillingAccessWindow,
  at: Date,
): boolean {
  const now = dateInputToTimestamp(at);
  const periodEnd = dateInputToTimestamp(access.currentPeriodEnd);
  if (now === null || periodEnd === null) {
    return false;
  }

  const periodStart = dateInputToTimestamp(access.currentPeriodStart);
  return (
    (access.status === "active" || access.status === "trialing") &&
    (access.currentPeriodStart == null ||
      (periodStart !== null && periodStart <= now)) &&
    now < periodEnd
  );
}

export function hasActiveProAccess(
  access: ProBillingAccess,
  at: Date,
): boolean {
  return access.tier === "pro" && isAccessActive(access, at);
}

export function effectiveAccessTier(
  access: ProBillingAccess,
  at: Date,
): "free" | "pro" {
  return hasActiveProAccess(access, at) ? "pro" : "free";
}
