import { asLocalCalendarDate } from '@psychage/shared/engagement';
import type { DailyEntry as CheckInEntry, DailyState as CheckInState } from '@/lib/daily-rollup';
import { describe, expect, it } from 'vitest';

import {
  buildTherapistPdfHtml,
  enumerateDays,
  summarizeRange,
  windowForDays,
} from '@/features/therapist/pdf/build-html';
import { generateAndShare, type PdfPrinter } from '@/features/therapist/pdf/printer';
import { syncLinkedProvider } from '@/features/therapist/use-provider';
import { THERAPIST_COPY } from '@/features/therapist/copy';

// The C-PDF is a PRINT artifact, generated LOCALLY. These prove it is grayscale-safe
// by construction, lists every day (no-entry days never omitted), carries honest
// counts + the two print-exclusive edge labels + the verbatim footer + a page count,
// holds the 8.5pt type floor, and carries no aggregates/clinical vocabulary.

function entry(date: string, state: CheckInState, note?: string, high: CheckInState = state): CheckInEntry {
  const base = { id: `id-${date}`, date: asLocalCalendarDate(date), state, low: state, high, count: high > state ? 2 : 1 };
  return note === undefined ? base : { ...base, note };
}

// 2026-06-01 .. 2026-06-18 = 18 days; 14 entries (01..14), 4 no-entry days (15..18).
const FROM = asLocalCalendarDate('2026-06-01');
const TO = asLocalCalendarDate('2026-06-18');
const ENTRIES: CheckInEntry[] = Array.from({ length: 14 }, (_, i) => {
  const day = String(i + 1).padStart(2, '0');
  return entry(`2026-06-${day}`, (i % 5) as CheckInState, i === 0 ? 'rough night' : undefined);
});

function htmlFor(fullName = 'Alex Rivers', locale?: string): string {
  return buildTherapistPdfHtml({ fullName, from: FROM, to: TO, entries: ENTRIES, locale });
}

describe('range helpers', () => {
  it('enumerateDays spans the inclusive range', () => {
    expect(enumerateDays(FROM, TO)).toHaveLength(18);
    expect(enumerateDays(asLocalCalendarDate('2026-01-31'), asLocalCalendarDate('2026-02-02'))).toEqual([
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('summarizeRange reports honest day + entry counts', () => {
    expect(summarizeRange(FROM, TO, ENTRIES)).toEqual({ dayCount: 18, entryCount: 14 });
  });

  it('windowForDays returns the inclusive last-N-day window', () => {
    expect(windowForDays(new Date(2026, 5, 14, 9, 0), 7)).toEqual({
      from: '2026-06-08',
      to: '2026-06-14',
    });
  });
});

describe('buildTherapistPdfHtml', () => {
  it('carries the honest counts', () => {
    expect(htmlFor()).toContain('18 days, 14 entries');
  });

  it('renders the branded masthead, document title, meta grid + table headers', () => {
    const html = htmlFor();
    expect(html).toContain('class="wordmark">Psychage<'); // brand masthead
    expect(html).toContain(`class="doc-title">${THERAPIST_COPY.checkIn.docTitle}<`);
    expect(html).toContain(`<dt>${THERAPIST_COPY.shell.metaName}</dt>`); // meta grid
    // The daily table now has labelled column headers (was a header-less wall before).
    expect(html).toContain(`<th class="h-state">${THERAPIST_COPY.checkIn.colState}</th>`);
  });

  it('emits the font-embed marker for the native printer to fill (or strip)', () => {
    expect(htmlFor()).toContain('/*__PDF_FONTS__*/');
  });

  it('lists every day in the range — no-entry days are never omitted', () => {
    const html = htmlFor();
    // 4 no-entry days (15..18).
    expect((html.match(/No entry/g) ?? []).length).toBe(4);
    // Every day appears as a dated row (18 weekday-prefixed rows).
    expect((html.match(/<td class="date">/g) ?? []).length).toBe(18);
  });

  it('has the two print-exclusive edge labels', () => {
    const html = htmlFor();
    expect(html).toContain('>Very good<');
    expect(html).toContain('>Very low<');
  });

  it('is grayscale-safe — every terrain dot keeps an ink ring (stroke)', () => {
    const circles = htmlFor().match(/<circle\b[^>]*>/g) ?? [];
    expect(circles.length).toBeGreaterThan(0);
    expect(circles.every((c) => /stroke="/.test(c))).toBe(true);
  });

  it('renders a low→high band (a round-capped line) for a multi-modal day', () => {
    // a single day spanning Very low (0) → Good (3) over the 1-day range
    const html = buildTherapistPdfHtml({
      fullName: 'Alex Rivers',
      from: asLocalCalendarDate('2026-06-01'),
      to: asLocalCalendarDate('2026-06-01'),
      entries: [entry('2026-06-01', 0, undefined, 3)],
    });
    const lines = html.match(/<line\b[^>]*>/g) ?? [];
    // the day band is the vertical, round-capped line (the baseline is a plain line)
    expect(lines.some((l) => /stroke-linecap="round"/.test(l))).toBe(true);
  });

  it('carries the verbatim footer and a per-page page count', () => {
    const html = htmlFor();
    expect(html).toContain(THERAPIST_COPY.pdfFooter);
    expect(html).toContain('counter(page)');
    expect(html).toContain('counter(pages)');
  });

  it('holds the 8.5pt type floor', () => {
    const sizes = [...htmlFor().matchAll(/font-size:\s*([\d.]+)pt/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(8.5);
  });

  it('defaults to A4 and uses Letter for a US locale', () => {
    expect(htmlFor('Alex', undefined)).toContain('size: A4');
    expect(htmlFor('Alex', 'en-US')).toContain('size: letter');
  });

  it('carries no aggregates or clinical vocabulary', () => {
    const lower = htmlFor().toLowerCase();
    expect(lower).not.toContain('average');
    expect(lower).not.toContain('score');
    expect(lower).not.toContain('diagnos');
    expect(lower).not.toContain('trend');
  });

  it('escapes user-provided text (no markup injection)', () => {
    const html = buildTherapistPdfHtml({
      fullName: '<script>alert(1)</script>',
      from: FROM,
      to: TO,
      entries: ENTRIES,
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('carries no "Prepared for" row when no provider is linked', () => {
    expect(htmlFor()).not.toContain('Prepared for');
  });

  it('stamps the linked provider as "Prepared for" (name + contact, escaped)', () => {
    const html = buildTherapistPdfHtml({
      fullName: 'Alex Rivers',
      from: FROM,
      to: TO,
      entries: ENTRIES,
      provider: { name: '<b>Dr. Sam & Co</b>', contact: 'sam@clinic.test' },
    });
    expect(html).toContain('<dt>Prepared for</dt>');
    expect(html).not.toContain('<b>Dr. Sam & Co</b>'); // never raw markup
    expect(html).toContain('&lt;b&gt;Dr. Sam &amp; Co&lt;/b&gt; · sam@clinic.test');
  });

  it('defaults to the session-linked provider (S39 mirror) when none is passed', () => {
    syncLinkedProvider({ name: 'Dr. Osei' });
    try {
      expect(htmlFor()).toContain('<dt>Prepared for</dt>');
      expect(htmlFor()).toContain('<dd>Dr. Osei</dd>');
    } finally {
      syncLinkedProvider(null);
    }
    expect(htmlFor()).not.toContain('Prepared for');
  });
});

describe('generateAndShare', () => {
  it('generates the PDF locally, then hands the file to the share sheet (in order)', async () => {
    const calls: string[] = [];
    const printer: PdfPrinter = {
      printToFile: async () => {
        calls.push('print');
        return 'file:///tmp/summary.pdf';
      },
      share: async (uri) => {
        calls.push(`share:${uri}`);
      },
    };

    const result = await generateAndShare('<html></html>', printer);
    expect(result).toEqual({ ok: true });
    expect(calls).toEqual(['print', 'share:file:///tmp/summary.pdf']);
  });

  it('resolves { ok: false } (never rejects) when generation fails — share is skipped', async () => {
    const calls: string[] = [];
    const printer: PdfPrinter = {
      printToFile: async () => {
        throw new Error('disk full');
      },
      share: async (uri) => {
        calls.push(`share:${uri}`);
      },
    };

    await expect(generateAndShare('<html></html>', printer)).resolves.toEqual({ ok: false });
    expect(calls).toEqual([]); // never shares a file that was not generated
  });

  it('resolves { ok: false } (never rejects) when the share sheet fails', async () => {
    const printer: PdfPrinter = {
      printToFile: async () => 'file:///tmp/summary.pdf',
      share: async () => {
        throw new Error('sharing-unavailable');
      },
    };

    await expect(generateAndShare('<html></html>', printer)).resolves.toEqual({ ok: false });
  });
});
