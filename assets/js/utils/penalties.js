export const DEFAULT_PENALTY_RULES = [
  { minutes: 1, amount: 1 },
  { minutes: 5, amount: 2 },
  { minutes: 15, amount: 3 },
  { minutes: 20, amount: 4 },
  { minutes: 30, amount: 10 }
];

export function calculatePenalty(minutesLate = 0, rules = DEFAULT_PENALTY_RULES) {
  const minutes = Number(minutesLate) || 0;
  if (minutes <= 0) return 0;

  return [...rules]
    .sort((a, b) => Number(a.minutes) - Number(b.minutes))
    .reduce((amount, rule) => (minutes >= Number(rule.minutes) ? Number(rule.amount) : amount), 0);
}

export function calculateTotalPenalty(records = [], rules = DEFAULT_PENALTY_RULES) {
  return records.reduce((total, record) => total + calculatePenalty(record.minutesLate, rules), 0);
}
