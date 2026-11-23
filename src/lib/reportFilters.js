export function isValidReportDateRange(from = '', to = '') {
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return false;
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) return false;
  if (from && Number.isNaN(Date.parse(from + 'T00:00:00'))) return false;
  if (to && Number.isNaN(Date.parse(to + 'T00:00:00'))) return false;
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
