function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function isValidReportDateRange(from = '', to = '') {
  if (from && !isCalendarDate(from)) return false;
  if (to && !isCalendarDate(to)) return false;
  return !(from && to && from > to);
}

export function filterEntriesByDateRange(entries, from = '', to = '') {
  if (!isValidReportDateRange(from, to)) return [];
  const start = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
  const end = to ? new Date(to + 'T23:59:59.999').getTime() : Infinity;
  return (entries || []).filter(entry => {
    const timestamp = new Date(entry.created_at).getTime();
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
  });
}
