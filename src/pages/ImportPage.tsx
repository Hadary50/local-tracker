import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import { downloadTemplate, readWorkbookFile, type SheetData } from '../lib/excel';
import {
  addBrand,
  applyImport,
  detectHeaderRow,
  guessMapping,
  lineResult,
  planImport,
  todayStr,
  type ImportMapping,
  type ImportMode,
} from '../lib/logic';
import { go, type Route } from '../hooks/useRoute';

const NEW_BRAND = '__new__';
const PREVIEW_LIMIT = 200;

const FIELD_LABELS: { key: keyof ImportMapping; label: string; required: boolean }[] = [
  { key: 'name', label: 'اسم المنتج', required: true },
  { key: 'qty', label: 'الكمية', required: true },
  { key: 'size', label: 'المقاس', required: false },
  { key: 'color', label: 'اللون', required: false },
  { key: 'sku', label: 'SKU / الكود', required: false },
  { key: 'image', label: 'رابط الصورة (URL)', required: false },
];

export default function ImportPage({ route }: { route: Route }) {
  const { data, mutate } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(1); // 1-based Excel row number
  const [mapping, setMapping] = useState<ImportMapping>({ name: -1, size: -1, color: -1, sku: -1, image: -1, qty: -1 });
  const [brandSel, setBrandSel] = useState(route.query.get('brand') ?? '');
  const [newBrand, setNewBrand] = useState('');
  const [mode, setMode] = useState<ImportMode | ''>('');
  const [error, setError] = useState('');

  const sheet: SheetData | undefined = sheets[sheetIdx];
  const headers = sheet?.rows[headerRow - 1] ?? [];
  const dataRows = sheet ? sheet.rows.slice(headerRow) : [];
  const colCount = sheet ? Math.max(0, ...sheet.rows.slice(headerRow - 1, headerRow + 20).map((r) => r.length)) : 0;

  const brandExists = data.brands.some((b) => b.id === brandSel);
  const brandProducts = useMemo(
    () => (brandExists ? data.products.filter((p) => p.brandId === brandSel) : []),
    [data.products, brandSel, brandExists],
  );

  const plan = useMemo(
    () =>
      sheet && mapping.name >= 0 && mapping.qty >= 0
        ? planImport(dataRows, mapping, brandProducts, headerRow + 1)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, headerRow, mapping, brandProducts],
  );

  const results = useMemo(
    () => (plan && mode ? plan.lines.map((l) => ({ l, ...lineResult(l, mode) })) : null),
    [plan, mode],
  );

  const brandReady = brandExists || (brandSel === NEW_BRAND && newBrand.trim() !== '');
  const canConfirm = !!plan && plan.lines.length > 0 && brandReady && !!mode;

  /* ------------------------------ handlers ------------------------------ */

  const loadSheet = (list: SheetData[], idx: number) => {
    const s = list[idx];
    const h = detectHeaderRow(s.rows);
    setSheetIdx(idx);
    setHeaderRow(h + 1);
    setMapping(guessMapping(s.rows[h] ?? []));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const list = await readWorkbookFile(file);
      if (list.length === 0) {
        setError('الملف فارغ أو لا يحتوي على بيانات.');
        return;
      }
      setFileName(file.name);
      setSheets(list);
      loadSheet(list, 0);
    } catch {
      setError('تعذّرت قراءة الملف. تأكد أنه بصيغة Excel (.xlsx أو .xls) أو CSV.');
    }
  };

  const changeHeaderRow = (n: number) => {
    if (!sheet) return;
    const row = Math.min(Math.max(1, n || 1), sheet.rows.length);
    setHeaderRow(row);
    setMapping(guessMapping(sheet.rows[row - 1] ?? []));
  };

  const reset = () => {
    setFileName('');
    setSheets([]);
    setMode('');
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirm = () => {
    if (!plan || !mode || !canConfirm) return;
    const r = mutate<{ created: number; updated: number }>((d) => {
      let working = d;
      let brandId = brandSel;
      if (brandSel === NEW_BRAND) {
        const b = addBrand(d, newBrand);
        if (!b.ok) return { ok: false as const, error: b.error };
        working = b.data;
        brandId = b.brand.id;
      }
      return applyImport(working, {
        brandId,
        lines: plan.lines,
        mode,
        user: d.settings.userName,
        date: todayStr(),
        source: fileName,
      });
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast(`تم الاستيراد: ${r.created} منتج جديد، ${r.updated} منتج تغيّرت كميته`);
    go('/inventory');
  };

  /* ------------------------------ summary ------------------------------ */

  const summary = useMemo(() => {
    if (!plan) return null;
    const merged = plan.lines.filter((l) => l.rows.length > 1).length;
    const newCount = plan.lines.filter((l) => l.productId === null).length;
    const fileQty = plan.lines.reduce((s, l) => s + l.importedQty, 0);
    let increase = 0;
    let decrease = 0;
    if (results) {
      for (const r of results) {
        if (r.delta > 0) increase += r.delta;
        else decrease += -r.delta;
      }
    }
    return { merged, newCount, existing: plan.lines.length - newCount, fileQty, increase, decrease };
  }, [plan, results]);

  /* -------------------------------- UI -------------------------------- */

  return (
    <>
      <PageHeader
        title="استيراد من Excel"
        subtitle="ارفع ملف العلامة، راجع المعاينة، ثم أكّد. لن يتغير أي مخزون قبل التأكيد."
        actions={
          <>
            <button className="btn btn-light" onClick={downloadTemplate}>
              <i className="bi bi-download me-1" /> تحميل نموذج
            </button>
            <a className="btn btn-light" href="#/inventory">
              رجوع للمخزون
            </a>
          </>
        }
      />

      {/* Step 1: file + brand */}
      <div className="card mb-3">
        <div className="card-header fw-bold">١. الملف والعلامة</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label small text-secondary">ملف Excel</label>
              <input
                ref={fileRef}
                type="file"
                className="form-control"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small text-secondary">العلامة صاحبة الملف</label>
              <select className="form-select" value={brandSel} onChange={(e) => setBrandSel(e.target.value)}>
                <option value="">اختر العلامة...</option>
                {data.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value={NEW_BRAND}>+ علامة جديدة...</option>
              </select>
              {brandSel === NEW_BRAND && (
                <input
                  className="form-control mt-2"
                  placeholder="اسم العلامة الجديدة"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                />
              )}
            </div>
          </div>
          {error && <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div>}
        </div>
      </div>

      {sheet && (
        <>
          {/* Step 2: mapping */}
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span className="fw-bold">٢. ربط الأعمدة</span>
              <span className="small text-secondary">{fileName}</span>
            </div>
            <div className="card-body">
              <div className="row g-3">
                {sheets.length > 1 && (
                  <div className="col-12 col-md-4">
                    <label className="form-label small text-secondary">الورقة (Sheet)</label>
                    <select
                      className="form-select"
                      value={sheetIdx}
                      onChange={(e) => loadSheet(sheets, Number(e.target.value))}
                    >
                      {sheets.map((s, i) => (
                        <option key={s.name} value={i}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col-6 col-md-2">
                  <label className="form-label small text-secondary">رقم صف العناوين</label>
                  <input
                    type="number"
                    min={1}
                    className="form-control"
                    value={headerRow}
                    onChange={(e) => changeHeaderRow(Number(e.target.value))}
                  />
                </div>
                {FIELD_LABELS.map((f) => (
                  <div className="col-6 col-md-3" key={f.key}>
                    <label className="form-label small text-secondary">
                      {f.label}
                      {f.required && <span className="text-danger"> *</span>}
                    </label>
                    <select
                      className="form-select"
                      value={mapping[f.key]}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                    >
                      <option value={-1}>— بدون —</option>
                      {Array.from({ length: colCount }, (_, i) => (
                        <option key={i} value={i}>
                          {headers[i]?.trim() ? headers[i] : `عمود ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {(mapping.name < 0 || mapping.qty < 0) && (
                <div className="alert alert-warning py-2 mt-3 mb-0">اختر عمود اسم المنتج وعمود الكمية للمتابعة.</div>
              )}
            </div>
          </div>

          {/* Step 3: mode */}
          <div className="card mb-3">
            <div className="card-header fw-bold">٣. ماذا تمثّل الكميات في هذا الملف؟</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className={`mode-card${mode === 'received' ? ' active' : ''}`}>
                    <input
                      type="radio"
                      className="form-check-input"
                      name="mode"
                      checked={mode === 'received'}
                      onChange={() => setMode('received')}
                    />
                    <div>
                      <div className="fw-bold">استلام مخزون جديد</div>
                      <div className="small text-secondary">
                        تُضاف كميات الملف إلى المخزون الحالي، وتُسجَّل حركة «استلام».
                      </div>
                    </div>
                  </label>
                </div>
                <div className="col-12 col-md-6">
                  <label className={`mode-card${mode === 'update' ? ' active' : ''}`}>
                    <input
                      type="radio"
                      className="form-check-input"
                      name="mode"
                      checked={mode === 'update'}
                      onChange={() => setMode('update')}
                    />
                    <div>
                      <div className="fw-bold">تحديث المخزون (جرد)</div>
                      <div className="small text-secondary">
                        تصبح كميات الملف هي الكمية الفعلية. يُسجَّل الفرق: الزيادة «استلام» والنقص «مفقود». المنتجات
                        غير الموجودة في الملف لا تتغير.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
              {!mode && <div className="form-text mt-2">اختر أحد الخيارين لعرض نتيجة الاستيراد وتفعيل زر التأكيد.</div>}
            </div>
          </div>

          {/* Step 4: preview */}
          {plan && summary && (
            <div className="card mb-3">
              <div className="card-header fw-bold">٤. المعاينة</div>
              <div className="card-body border-bottom">
                <div className="d-flex flex-wrap gap-3 small">
                  <span>
                    منتجات في الملف: <b>{plan.lines.length}</b>
                  </span>
                  <span>
                    جديدة: <b className="text-success">{summary.newCount}</b>
                  </span>
                  <span>
                    موجودة: <b>{summary.existing}</b>
                  </span>
                  <span>
                    إجمالي كميات الملف: <b>{summary.fileQty}</b>
                  </span>
                  {mode && (
                    <>
                      <span>
                        زيادة في المخزون: <b className="text-success">+{summary.increase}</b>
                      </span>
                      <span>
                        نقص في المخزون: <b className="text-danger">−{summary.decrease}</b>
                      </span>
                    </>
                  )}
                </div>
                {summary.merged > 0 && (
                  <div className="small text-secondary mt-2">
                    {summary.merged} منتج تكرر في الملف أكثر من مرة، فجُمعت كمياته.
                  </div>
                )}
                {mode === 'update' && summary.decrease > 0 && (
                  <div className="alert alert-warning py-2 mt-3 mb-0">
                    سيتم تسجيل النقص ({summary.decrease} قطعة) كحركة «مفقود». راجع الأرقام قبل التأكيد.
                  </div>
                )}
              </div>

              {plan.lines.length === 0 ? (
                <div className="p-4 text-center text-secondary">لا توجد صفوف صالحة للاستيراد.</div>
              ) : (
                <div className="table-responsive preview-scroll">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>الحالة</th>
                        <th>الصورة</th>
                        <th>المنتج</th>
                        <th>المقاس</th>
                        <th>اللون</th>
                        <th>SKU</th>
                        <th className="text-center">في الملف</th>
                        <th className="text-center">الحالي</th>
                        <th className="text-center">بعد الاستيراد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.lines.slice(0, PREVIEW_LIMIT).map((l) => {
                        const r = mode ? lineResult(l, mode) : null;
                        return (
                          <tr key={l.key}>
                            <td>
                              {l.productId === null ? (
                                <span className="badge text-bg-success">جديد</span>
                              ) : (
                                <span className="badge text-bg-secondary">موجود</span>
                              )}
                            </td>
                            <td>
                              {l.image ? (
                                <img
                                  src={l.image}
                                  alt=""
                                  className="rounded object-fit-cover border"
                                  style={{ width: 32, height: 32 }}
                                  onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                                />
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td>{l.name}</td>
                            <td>{l.size || '—'}</td>
                            <td>{l.color || '—'}</td>
                            <td className="text-secondary">{l.sku || '—'}</td>
                            <td className="text-center">{l.importedQty}</td>
                            <td className="text-center">{l.currentQty}</td>
                            <td className="text-center fw-semibold">
                              {r ? (
                                <>
                                  {r.newQty}
                                  {r.delta !== 0 && (
                                    <span className={`small ms-1 ${r.delta > 0 ? 'text-success' : 'text-danger'}`} dir="ltr">
                                      ({r.delta > 0 ? '+' : '−'}
                                      {Math.abs(r.delta)})
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-secondary">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {plan.lines.length > PREVIEW_LIMIT && (
                <div className="card-footer small text-secondary">
                  تُعرض أول {PREVIEW_LIMIT} من {plan.lines.length} منتج. سيُستورد الجميع عند التأكيد.
                </div>
              )}

              {plan.skipped.length > 0 && (
                <details className="card-footer">
                  <summary className="text-warning-emphasis small">
                    {plan.skipped.length} صف سيتم تجاهله (اضغط للتفاصيل)
                  </summary>
                  <ul className="small mb-0 mt-2">
                    {plan.skipped.slice(0, 50).map((s) => (
                      <li key={s.row}>
                        صف {s.row}: {s.reason}
                      </li>
                    ))}
                    {plan.skipped.length > 50 && <li>... و{plan.skipped.length - 50} صف آخر</li>}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 mb-4">
            <button className="btn btn-light" onClick={reset}>
              إلغاء
            </button>
            <button className="btn btn-success px-4" disabled={!canConfirm} onClick={confirm}>
              <i className="bi bi-check2-circle me-1" /> تأكيد الاستيراد
            </button>
          </div>
          {!canConfirm && (
            <div className="form-text text-end mb-4">
              {!brandReady
                ? 'اختر العلامة (أو اكتب اسم علامة جديدة).'
                : !mode
                  ? 'اختر نوع الاستيراد في الخطوة ٣.'
                  : !plan || plan.lines.length === 0
                    ? 'لا توجد صفوف صالحة للاستيراد.'
                    : ''}
            </div>
          )}
        </>
      )}
    </>
  );
}
