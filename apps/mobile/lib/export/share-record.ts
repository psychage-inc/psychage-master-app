import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// S46 file hand-off. Writes the serialized record to a cache file and opens the
// OS share sheet. Native modules — jest render tests mock 'expo-file-system' and
// 'expo-sharing'. The pure serialization (toJSON/toCSV) lives in record-export.ts.

export type ExportFormat = 'json' | 'csv';

const META: Record<ExportFormat, { filename: string; mimeType: string; uti: string }> = {
  json: {
    filename: 'psychage-record.json',
    mimeType: 'application/json',
    uti: 'public.json',
  },
  csv: {
    filename: 'psychage-record.csv',
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
  },
};

export async function shareRecordFile(format: ExportFormat, content: string): Promise<void> {
  const meta = META[format];
  const file = new File(Paths.cache, meta.filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: meta.mimeType,
      UTI: meta.uti,
      dialogTitle: 'Export your Psychage record',
    });
  }
  // NOTE: the file is deliberately NOT deleted here. shareAsync resolves when
  // our activity resumes, but the receiving app (Gmail, Drive, share
  // extensions) reads the content:// URI AFTER that — deleting in a finally
  // truncated the handoff (second-pass review of PR-014). The file is replaced
  // on the next export (delete-then-create above) and removed by both wipe
  // flows via deleteExportedRecordFiles(), which is what PR-014 required.
}

/**
 * Best-effort removal of any exported record files from the cache dir. Also
 * called by the wipe flows (S48 delete / privacy clear) so an export made
 * before deletion cannot outlive it.
 */
export function deleteExportedRecordFiles(): void {
  for (const meta of Object.values(META)) {
    try {
      const file = new File(Paths.cache, meta.filename);
      if (file.exists) file.delete();
    } catch {
      // Best-effort: a locked/missing file must never break the share or wipe flow.
    }
  }
}
