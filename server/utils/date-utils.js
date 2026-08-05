/**
 * Calculate business days between two dates (simple version — counts all days).
 * For production, add holiday support via settings.working_days.
 */
export function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function formatDate(dateStr, locale = 'zh') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (locale === 'zh') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function validateDependency(predecessor, successor, type, lag = 0) {
  const preStart = new Date(predecessor.start_date);
  const preEnd = new Date(predecessor.end_date);
  const sucStart = new Date(successor.start_date);
  const sucEnd = new Date(successor.end_date);

  const lagMs = lag * 24 * 60 * 60 * 1000;

  switch (type) {
    case 'FS':
      return sucStart.getTime() >= preEnd.getTime() + lagMs;
    case 'SS':
      return sucStart.getTime() >= preStart.getTime() + lagMs;
    case 'FF':
      return sucEnd.getTime() >= preEnd.getTime() + lagMs;
    case 'SF':
      return sucEnd.getTime() >= preStart.getTime() + lagMs;
    default:
      return true;
  }
}
