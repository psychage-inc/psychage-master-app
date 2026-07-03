import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { IBMPlexSans_400Regular, IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildFontFaceCss, type PdfFontData, PDF_FONTS_MARKER } from './pdf-fonts';
import type { PdfPrinter } from './printer';

// The native PdfPrinter. Imports expo-print/expo-sharing, so it is consumed only by
// the route (never by Vitest — the pure order logic + the HTML builder are tested
// without these native modules). Generation is LOCAL/offline-capable; the share is
// the platform sheet.
//
// Brand fonts (Fraunces + IBM Plex Sans) are embedded HERE, not in the pure builder:
// the bundled .ttf bytes are read + base64-encoded on first export and injected at the
// PDF_FONTS_MARKER the shell emits. This keeps ~1MB of font bytes out of the JS bundle.
// Encoding happens once per session; on ANY failure we strip the marker and fall back to
// system fonts so the document always generates.

let fontCssPromise: Promise<string> | null = null;

async function encodeFont(mod: number): Promise<string> {
  const asset = await Asset.fromModule(mod).downloadAsync();
  return new File(asset.localUri ?? asset.uri).base64();
}

async function loadFontFaceCss(): Promise<string> {
  try {
    const [fraunces600, plex400, plex700] = await Promise.all([
      encodeFont(Fraunces_600SemiBold),
      encodeFont(IBMPlexSans_400Regular),
      encodeFont(IBMPlexSans_700Bold),
    ]);
    const data: PdfFontData = { fraunces600, plex400, plex700 };
    return buildFontFaceCss(data);
  } catch {
    return ''; // graceful fallback — system fonts; the PDF still renders
  }
}

async function withEmbeddedFonts(html: string): Promise<string> {
  if (!fontCssPromise) fontCssPromise = loadFontFaceCss();
  const css = await fontCssPromise;
  // base64 + @font-face contain no `$`, so a plain string replace is safe here.
  return html.replace(PDF_FONTS_MARKER, css);
}

export const expoPdfPrinter: PdfPrinter = {
  async printToFile(html: string) {
    const withFonts = await withEmbeddedFonts(html);
    const { uri } = await Print.printToFileAsync({ html: withFonts });
    return uri;
  },
  async share(uri: string) {
    if (!(await Sharing.isAvailableAsync())) {
      // No share surface on this device — a FAILURE the caller must hear about,
      // never a silent no-op (generateAndShare converts it to { ok: false }).
      throw new Error('sharing-unavailable');
    }
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  },
};
