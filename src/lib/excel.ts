import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export interface SheetData {
  name: string;
  rows: string[][];
}

function cellToString(c: unknown): string {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c).trim();
}

/**
 * Extracts embedded images anchored to cell coordinates (row, col) from an .xlsx file.
 * Returns a map of `${row}_${col}` => `data:image/...;base64,...`
 */
async function extractEmbeddedImages(buf: ArrayBuffer): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  try {
    const zip = await JSZip.loadAsync(buf);

    // Map drawing relationship IDs to media files
    // Drawing rels are typically at xl/drawings/_rels/drawing1.xml.rels
    const relFiles = Object.keys(zip.files).filter((path) =>
      path.match(/^xl\/drawings\/_rels\/.*\.rels$/),
    );

    const relMap: Record<string, string> = {};
    for (const relPath of relFiles) {
      const relsXml = await zip.file(relPath)?.async('string');
      if (!relsXml) continue;
      const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g;
      let match;
      while ((match = relRegex.exec(relsXml)) !== null) {
        // e.g. ../media/image1.png -> xl/media/image1.png
        const target = match[2].replace(/^(\.\.\/)+/, 'xl/');
        relMap[match[1]] = target;
      }
    }

    // Parse drawing XMLs to find cell coordinates
    const drawingFiles = Object.keys(zip.files).filter((path) =>
      path.match(/^xl\/drawings\/drawing\d+\.xml$/),
    );

    for (const drawPath of drawingFiles) {
      const drawXml = await zip.file(drawPath)?.async('string');
      if (!drawXml) continue;

      const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
      let aMatch;
      while ((aMatch = anchorRegex.exec(drawXml)) !== null) {
        const anchorContent = aMatch[1];
        const fromMatch = anchorContent.match(
          /<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/,
        );
        const blipMatch = anchorContent.match(/r:embed="([^"]+)"/);

        if (fromMatch && blipMatch) {
          const col = parseInt(fromMatch[1], 10);
          const row = parseInt(fromMatch[2], 10);
          const relId = blipMatch[1];
          const mediaPath = relMap[relId];

          if (mediaPath && zip.file(mediaPath)) {
            const base64Data = await zip.file(mediaPath)!.async('base64');
            const ext = mediaPath.split('.').pop()?.toLowerCase() || 'jpeg';
            const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
            const dataUri = `data:${mime};base64,${base64Data}`;
            imageMap.set(`${row}_${col}`, dataUri);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not extract embedded images from xlsx:', err);
  }
  return imageMap;
}

/** Reads every non-empty sheet of an .xlsx / .xls / .csv file as rows of text. */
export async function readWorkbookFile(file: File): Promise<SheetData[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  // Try extracting embedded images (works for xlsx files)
  const embeddedImages = await extractEmbeddedImages(buf);

  const sheets: SheetData[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;

    // Check if cell has hyperlinks (e.g., text displayed as "صورة" but has link in l.Target)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[cellAddress];
        if (cell && cell.l && cell.l.Target) {
          // If the cell text is not a full URL or is just label text, set its value to the link Target
          const strVal = String(cell.v ?? '').trim();
          if (!strVal.startsWith('http://') && !strVal.startsWith('https://')) {
            cell.v = cell.l.Target;
          }
        }
      }
    }

    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false });
    const rows = raw.map((r, rowIdx) =>
      r.map((c, colIdx) => {
        const val = cellToString(c);
        // If the cell has an embedded image from Excel drawings, use the base64 dataUri
        if (!val || val === '') {
          const img = embeddedImages.get(`${rowIdx}_${colIdx}`);
          if (img) return img;
        }
        return val;
      }),
    );
    if (rows.length > 0) sheets.push({ name, rows });
  }
  return sheets;
}

export interface ExportSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

const safeSheetName = (s: string) => s.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';

/** Downloads an Excel file (right-to-left sheets). */
export function exportWorkbook(filename: string, sheets: ExportSheet[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows]);
    ws['!cols'] = s.headers.map((h, i) => {
      const longest = s.rows.reduce((m, r) => Math.max(m, String(r[i] ?? '').length), h.length);
      return { wch: Math.min(40, Math.max(10, longest + 3)) };
    });
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(s.name));
  }
  wb.Workbook = { Views: sheets.map(() => ({ RTL: true })) };
  XLSX.writeFile(wb, filename);
}

/** A small example file brands can follow. */
export function downloadTemplate() {
  exportWorkbook('نموذج-استيراد-المخزون.xlsx', [
    {
      name: 'المخزون',
      headers: ['اسم المنتج', 'المقاس', 'اللون', 'الكود (SKU)', 'رابط الصورة', 'الكمية'],
      rows: [
        ['تيشيرت قطن', 'M', 'أسود', 'TS-001', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=100', 12],
        ['تيشيرت قطن', 'L', 'أبيض', 'TS-002', '', 8],
      ],
    },
  ]);
}
