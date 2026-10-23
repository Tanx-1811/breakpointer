import type { PageStats } from '../agent/protocol';
import { statValue, type StatMetric } from './audit';

/**
 * Performance budgets (Pro): limits for what a page may cost at any size —
 * the bytes it transfers, its requests, its largest contentful paint and its
 * layout shift. The audit's Performance tab marks every preview over a limit.
 * Set in Settings; a limit of null is no limit.
 */
export type BudgetMetric = 'transferred' | 'requests' | 'lcp' | 'cls';
export const BUDGET_METRICS: readonly BudgetMetric[] = ['transferred', 'requests', 'lcp', 'cls'];

/** `transferred` in kilobytes (1000 bytes), `lcp` in milliseconds. */
export type PerformanceBudgets = Record<BudgetMetric, number | null>;

export const EMPTY_BUDGETS: PerformanceBudgets = { transferred: null, requests: null, lcp: null, cls: null };

/** The largest limit accepted for each budget (a typo shouldn't save 10^12). */
export const BUDGET_MAX: Record<BudgetMetric, number> = { transferred: 100_000, requests: 5000, lcp: 60_000, cls: 10 };

export const isBudgetMetric = (metric: StatMetric): metric is BudgetMetric =>
  (BUDGET_METRICS as readonly string[]).includes(metric);

/** A limit as typed or stored: a number from 0 to the maximum (CLS to hundredths, others whole), else no limit. */
export function budgetValue(metric: BudgetMetric, raw: unknown): number | null {
  const value = typeof raw === 'string' ? (raw.trim() === '' ? NaN : Number(raw.replace(',', '.'))) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const clamped = Math.min(BUDGET_MAX[metric], value);
  return metric === 'cls' ? Math.round(clamped * 100) / 100 : Math.round(clamped);
}

/** Stored or imported budgets are untrusted: each one is checked on its own. */
export function parseBudgets(raw: unknown): PerformanceBudgets {
  const record = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    transferred: budgetValue('transferred', record.transferred),
    requests: budgetValue('requests', record.requests),
    lcp: budgetValue('lcp', record.lcp),
    cls: budgetValue('cls', record.cls),
  };
}

export const hasBudgets = (budgets: PerformanceBudgets) => BUDGET_METRICS.some((metric) => budgets[metric] !== null);

/** The limit in the stat's own unit (bytes for `transferred`), or null. */
export function budgetLimit(metric: StatMetric, budgets: PerformanceBudgets): number | null {
  if (!isBudgetMetric(metric)) return null;
  const limit = budgets[metric];
  if (limit === null) return null;
  return metric === 'transferred' ? limit * 1000 : limit;
}

/** True when this preview's value is over the limit (a value the page didn't report is never over). */
export function overBudget(stats: PageStats, metric: StatMetric, budgets: PerformanceBudgets): boolean {
  const limit = budgetLimit(metric, budgets);
  const value = statValue(stats, metric);
  return limit !== null && value !== null && value > limit;
}

/** Each budget exceeded, with how many previews exceed it. */
export function budgetBreaches(
  stats: readonly PageStats[],
  budgets: PerformanceBudgets,
): { metric: BudgetMetric; previews: number }[] {
  return BUDGET_METRICS.map((metric) => ({
    metric,
    previews: stats.filter((item) => overBudget(item, metric, budgets)).length,
  })).filter((breach) => breach.previews > 0);
}
