import { describe, expect, it } from 'vitest';
import { filterEntriesByDateRange, isValidReportDateRange } from '../lib/reportFilters.js';

const rows = [
  { id: 'before', created_at: '2026-01-01T23:59:59.000Z' },
  { id: 'inside-start', created_at: '2026-01-02T00:00:00.000Z' },
  { id: 'inside-end', created_at: '2026-01-03T23:59:59.999Z' },
  { id: 'after', created_at: '2026-01-04T00:00:00.000Z' },
  { id: 'invalid', created_at: 'not-a-date' }
];

describe('report date range', () => {
  it('accepts empty and valid ranges', () => {
    expect(isValidReportDateRange()).toBe(true);
    expect(isValidReportDateRange('2026-01-02', '2026-01-03')).toBe(true);
  });
  it('rejects inverted or malformed ranges', () => {
    expect(isValidReportDateRange('2026-01-04', '2026-01-03')).toBe(false);
    expect(isValidReportDateRange('02-01-2026', '')).toBe(false);
    expect(isValidReportDateRange('2026-02-31', '')).toBe(false);
    expect(isValidReportDateRange('2026-13-01', '')).toBe(false);
    expect(isValidReportDateRange('2024-02-29', '')).toBe(true);
    expect(isValidReportDateRange('2025-02-29', '')).toBe(false);
  });
  it('includes both boundary days and excludes invalid timestamps', () => {
    expect(filterEntriesByDateRange(rows, '2026-01-02', '2026-01-03').map(x => x.id))
      .toEqual(['inside-start', 'inside-end']);
  });
  it('returns no entries for an inverted range', () => {
    expect(filterEntriesByDateRange(rows, '2026-01-04', '2026-01-02')).toEqual([]);
  });
});
