// PDF print/share SEAM (pure — no expo import, so it is Vitest-testable). The native
// impl lives in expo-printer.ts. Generation is LOCAL (works offline); the share is
// platform-handled. PII-on-share is flagged for review.

export interface PdfPrinter {
  /** Render the HTML to a local PDF file; returns its file URI. LOCAL — no network. */
  printToFile(html: string): Promise<string>;
  /** Hand the file to the platform share sheet. */
  share(uri: string): Promise<void>;
}

/** Outcome of a generate-and-share attempt. Never a rejection — callers check `ok`. */
export type GenerateAndShareResult = { readonly ok: true } | { readonly ok: false };

/** Calm feedback for a failed export — shared by every PDF-sharing surface. */
export const PDF_SHARE_FAILED_COPY = {
  title: "Couldn't create the PDF right now",
  message: 'Please try again in a moment.',
} as const;

/**
 * Generate the PDF locally, then hand it to the share sheet (in that order).
 * NEVER rejects: print/share can fail (disk full, share sheet already open on an
 * Android double-tap, sharing unavailable) — all failures resolve as { ok: false }
 * so callers surface calm feedback instead of an unhandled rejection.
 */
export async function generateAndShare(
  html: string,
  printer: PdfPrinter,
): Promise<GenerateAndShareResult> {
  try {
    const uri = await printer.printToFile(html);
    await printer.share(uri);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
