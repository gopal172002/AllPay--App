import type {Transaction} from '../types';

export type ExpensePolicy = {
  id: string;
  name: string;
  mccCategory: string;
  maxPerTransaction: number;
  maxPerMonth: number;
  allowedDays: number[];
  scopeType: 'all' | 'department' | 'employee';
  scopeValue?: string;
  startDate: string;
  endDate?: string;
  active?: boolean;
};

const CATEGORY_ALIASES: Record<string, string> = {
  food: 'food',
  meals: 'food',
  meal: 'food',
  dining: 'food',
  fuel: 'fuel',
  travel: 'travel',
  groceries: 'groceries',
  grocery: 'groceries',
  office: 'office',
  all: 'all',
};

function normalizeCategory(category: string): string {
  const key = category.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? key;
}

function categoriesMatch(policyCategory: string, txCategory: string): boolean {
  const policyNorm = normalizeCategory(policyCategory);
  if (!policyCategory || policyNorm === 'all') {
    return true;
  }
  return policyNorm === normalizeCategory(txCategory);
}

function isPolicyActive(policy: ExpensePolicy, at = new Date()): boolean {
  if (policy.active === false) {
    return false;
  }
  const start = policy.startDate ? new Date(policy.startDate) : null;
  const end = policy.endDate ? new Date(policy.endDate) : null;
  if (start && at < start) {
    return false;
  }
  if (end) {
    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);
    if (at > endDay) {
      return false;
    }
  }
  return true;
}

function inPolicyScope(
  employeeId: string,
  department: string,
  policy: ExpensePolicy,
): boolean {
  if (policy.scopeType === 'all') {
    return true;
  }
  if (policy.scopeType === 'department') {
    return Boolean(policy.scopeValue) && department === policy.scopeValue;
  }
  if (policy.scopeType === 'employee') {
    return Boolean(policy.scopeValue) && employeeId === policy.scopeValue;
  }
  return false;
}

function monthlyCategorySpend(
  transactions: Transaction[],
  employeeId: string,
  category: string,
  allCategories = false,
): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const cat = normalizeCategory(category);
  return transactions
    .filter(tx => {
      const d = new Date(tx.timestamp);
      if (tx.employeeId !== employeeId || d.getMonth() !== month || d.getFullYear() !== year) {
        return false;
      }
      if (allCategories) {
        return true;
      }
      return normalizeCategory(tx.merchant.category) === cat;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export function getPolicyWarningFromPolicies(
  amount: number,
  category: string,
  employeeId: string,
  department: string,
  policies: ExpensePolicy[],
  transactions: Transaction[],
): string | null {
  const now = new Date();
  const warnings: string[] = [];

  for (const policy of policies) {
    if (!isPolicyActive(policy, now)) {
      continue;
    }
    if (!inPolicyScope(employeeId, department, policy)) {
      continue;
    }
    if (!categoriesMatch(policy.mccCategory, category)) {
      continue;
    }

    if (policy.maxPerTransaction && amount > policy.maxPerTransaction) {
      warnings.push(
        `${policy.name}: Amount Rs.${amount} exceeds per-transaction cap of Rs.${policy.maxPerTransaction}`,
      );
    }

    const dow = now.getDay();
    if (policy.allowedDays?.length && !policy.allowedDays.includes(dow)) {
      warnings.push(`${policy.name}: Payments are not allowed on this weekday`);
    }

    if (policy.maxPerMonth) {
      const policyNorm = normalizeCategory(policy.mccCategory);
      const allCats = !policy.mccCategory || policyNorm === 'all';
      const spent = monthlyCategorySpend(
        transactions,
        employeeId,
        category,
        allCats,
      );
      const projected = spent + amount;
      if (projected > policy.maxPerMonth) {
        warnings.push(
          `${policy.name}: Monthly spend would be Rs.${projected.toFixed(2)}, over cap of Rs.${policy.maxPerMonth}`,
        );
      }
    }
  }

  return warnings.length ? warnings.join('\n') : null;
}
