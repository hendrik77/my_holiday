import { describe, it, expect } from 'vitest';
import type { VacationPeriod } from '../types';
import { generateICS, generateICSForPeriod } from './ics';

const samplePeriods: VacationPeriod[] = [
  {
    id: 'abc123',
    startDate: '2026-07-01',
    endDate: '2026-07-10',
    note: 'Sommerurlaub am Meer',
    type: 'urlaub',
  },
  {
    id: 'def456',
    startDate: '2026-12-23',
    endDate: '2026-12-27',
    note: 'Weihnachten',
    type: 'urlaub',
  },
  {
    id: 'ghi789',
    startDate: '2025-12-28',
    endDate: '2026-01-03',
    note: 'Silvester',
    type: 'urlaub',
  },
];

// ============================================================
// generateICSForPeriod
// ============================================================
describe('generateICSForPeriod', () => {
  it('generates a VEVENT for a single-day period', () => {
    const result = generateICSForPeriod(
      { id: 'test-1', startDate: '2026-07-15', endDate: '2026-07-15', note: '' },
    );

    expect(result).toContain('BEGIN:VEVENT');
    expect(result).toContain('DTSTART;VALUE=DATE:20260715');
    expect(result).toContain('DTEND;VALUE=DATE:20260716'); // exclusive end
    expect(result).toContain('UID:test-1@my-holiday');
    expect(result).toContain('SUMMARY:Urlaub');
    expect(result).toContain('END:VEVENT');
  });

  it('generates correct DTEND for a multi-day period (exclusive end)', () => {
    const result = generateICSForPeriod(
      { id: 'test-2', startDate: '2026-07-01', endDate: '2026-07-10', note: '' },
    );

    expect(result).toContain('DTSTART;VALUE=DATE:20260701');
    expect(result).toContain('DTEND;VALUE=DATE:20260711');
  });

  it('includes period note in DESCRIPTION', () => {
    const result = generateICSForPeriod(
      { id: 'test-3', startDate: '2026-06-01', endDate: '2026-06-05', note: 'Team-Event' },
    );

    expect(result).toContain('DESCRIPTION:Team-Event');
  });

  it('omits DESCRIPTION when note is empty', () => {
    const result = generateICSForPeriod(
      { id: 'test-4', startDate: '2026-06-01', endDate: '2026-06-05', note: '' },
    );

    expect(result).not.toContain('DESCRIPTION');
  });

  it('includes DTSTAMP in UTC format', () => {
    const result = generateICSForPeriod(
      { id: 'test-5', startDate: '2026-03-01', endDate: '2026-03-05', note: '' },
    );

    // DTSTAMP should be in format YYYYMMDDTHHMMSSZ
    expect(result).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it('escapes commas in text fields', () => {
    const result = generateICSForPeriod(
      { id: 'test-6', startDate: '2026-06-01', endDate: '2026-06-05', note: 'Hello, World' },
    );

    expect(result).toContain('DESCRIPTION:Hello\\, World');
  });

  it('escapes semicolons in text fields', () => {
    const result = generateICSForPeriod(
      { id: 'test-7', startDate: '2026-06-01', endDate: '2026-06-05', note: 'A; B; C' },
    );

    expect(result).toContain('DESCRIPTION:A\\; B\\; C');
  });

  it('escapes backslashes in text fields', () => {
    const result = generateICSForPeriod(
      { id: 'test-8', startDate: '2026-06-01', endDate: '2026-06-05', note: 'Path\\to\\file' },
    );

    expect(result).toContain('DESCRIPTION:Path\\\\to\\\\file');
  });

  it('escapes newlines in text fields', () => {
    const result = generateICSForPeriod(
      { id: 'test-9', startDate: '2026-06-01', endDate: '2026-06-05', note: 'Line1\nLine2' },
    );

    expect(result).toContain('DESCRIPTION:Line1\\nLine2');
  });

  it('folds long lines (>75 chars) according to RFC 5545', () => {
    const result = generateICSForPeriod(
      {
        id: 'test-10',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        note: 'This is a very long description that should be folded across multiple lines in accordance with RFC 5545 content line folding rules',
      },
    );

    // After folding, DESCRIPTION should have continuation lines starting with space
    const lines = result.split('\r\n');
    const descLines = lines.filter((l) => l.startsWith('DESCRIPTION') || l.startsWith(' '));
    expect(descLines.length).toBeGreaterThan(1);
  });

  it('labels vacation type in summary', () => {
    const result = generateICSForPeriod(
      { id: 'test-11', startDate: '2026-06-01', endDate: '2026-06-05', note: '', type: 'bildungsurlaub' },
    );

    expect(result).toContain('SUMMARY:Bildungsurlaub');
  });

  it('defaults to "Urlaub" when type is undefined', () => {
    const result = generateICSForPeriod(
      { id: 'test-12', startDate: '2026-06-01', endDate: '2026-06-05', note: '' },
    );

    expect(result).toContain('SUMMARY:Urlaub');
  });
});

// ============================================================
// generateICS
// ============================================================
describe('generateICS', () => {
  it('generates a complete VCALENDAR for multiple periods', () => {
    const result = generateICS(samplePeriods, 2026);

    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('VERSION:2.0');
    expect(result).toContain('PRODID:-//My Holiday//my-holiday//EN');
    expect(result).toContain('END:VCALENDAR');

    // Should contain 3 VEVENT blocks
    const veventCount = (result.match(/BEGIN:VEVENT/g) || []).length;
    expect(veventCount).toBe(3);
  });

  it('generates a calendar with no events for empty periods', () => {
    const result = generateICS([], 2026);

    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('END:VCALENDAR');
    expect(result).not.toContain('BEGIN:VEVENT');
  });

  it('clips periods to the target year (skips periods entirely outside)', () => {
    // Period entirely in 2025
    const periods: VacationPeriod[] = [
      { id: 'p1', startDate: '2025-06-01', endDate: '2025-06-10', note: 'Old', type: 'urlaub' },
    ];

    // When exporting for 2026, this period should be excluded
    const result = generateICS(periods, 2026);
    expect(result).not.toContain('BEGIN:VEVENT');
  });

  it('includes periods that overlap with the target year (clips start)', () => {
    // Period starts in 2025, ends in 2026
    const periods: VacationPeriod[] = [
      { id: 'p1', startDate: '2025-12-28', endDate: '2026-01-03', note: 'Silvester', type: 'urlaub' },
    ];

    const result = generateICS(periods, 2026);
    expect(result).toContain('BEGIN:VEVENT');
    // Should be clipped to 2026 portion: DTSTART=20260101
    expect(result).toContain('DTSTART;VALUE=DATE:20260101');
    expect(result).toContain('DTEND;VALUE=DATE:20260104');
  });

  it('includes periods that overlap with the target year (clips end)', () => {
    // Period starts in 2026, ends in 2027
    const periods: VacationPeriod[] = [
      { id: 'p1', startDate: '2026-12-28', endDate: '2027-01-03', note: 'Silvester', type: 'urlaub' },
    ];

    const result = generateICS(periods, 2026);
    expect(result).toContain('BEGIN:VEVENT');
    expect(result).toContain('DTSTART;VALUE=DATE:20261228');
    expect(result).toContain('DTEND;VALUE=DATE:20270101'); // exclusive: Dec 31 + 1
  });

  it('does not clip when period is fully inside the year', () => {
    const periods: VacationPeriod[] = [
      { id: 'p1', startDate: '2026-07-01', endDate: '2026-07-10', note: '', type: 'urlaub' },
    ];

    const result = generateICS(periods, 2026);
    expect(result).toContain('DTSTART;VALUE=DATE:20260701');
    expect(result).toContain('DTEND;VALUE=DATE:20260711');
  });

  it('always uses CRLF line endings', () => {
    const result = generateICS(samplePeriods, 2026);
    const lines = result.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    // No bare \n without \r
    expect(result).not.toMatch(/(?<!\r)\n/);
  });

  it('includes X-WR-CALNAME header', () => {
    const result = generateICS(samplePeriods, 2026);
    expect(result).toContain('X-WR-CALNAME:My Holiday');
  });
});
