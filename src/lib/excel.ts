import * as XLSX from 'xlsx';

export interface SheetData {
  name: string;
  rows: string[][];
}

function cellToString(c: unknown): string {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c).trim();
}

/** Reads every non-empty sheet of an .xlsx / .xls / .csv file as rows of text. */
export async function readWorkbookFile(file: File): Promise<SheetData[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
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
    const rows = raw.map((r) => r.map(cellToString));
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
