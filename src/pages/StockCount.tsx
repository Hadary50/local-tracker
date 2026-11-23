import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useToast } from '../components/Toast';
import ProductPicker from '../components/ProductPicker';
import { PageHeader, ProductImage, variantLabel } from '../components/ui';
import { applyMovement, matchesQuery, sortProducts, todayStr } from '../lib/logic';
import type { Product } from '../types';

const SHORTAGE_REASONS = ['مفقود / لم يُعثر عليه', 'سرقة', 'تالف', 'خطأ في التسجيل السابق', 'أخرى'];
const SURPLUS_REASONS = ['وُجد في المخزن', 'خطأ في التسجيل السابق', 'مرتجع لم يُسجَّل', 'أخرى'];

export default function StockCount() {
  const [mode, setMode] = useState<'sheet' | 'single'>('sheet');

  return (
    <>
      <PageHeader
        title="جرد المخزون"
        subtitle="مطابقة الكميات الفعلية في المخزن مع رصيد النظام وتسجيل الفروقات"
        actions={
          <div className="btn-group">
            <button
              className={`btn ${mode === 'sheet' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setMode('sheet')}
            >
              <i className="bi bi-table me-1" /> جدول الجرد الشامل
            </button>
            <button
              className={`btn ${mode === 'single' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setMode('single')}
            >
              <i className="bi bi-box-seam me-1" /> جرد منتج منتج
            </button>
          </div>
        }
      />

      {mode === 'sheet' ? <BatchStockCount /> : <SingleStockCount />}
    </>
  );
}

/* ------------------------------------------------------------- */
/* 1. جدول الجرد الشامل (Batch Inventory Count)                 */
/* ------------------------------------------------------------- */

function BatchStockCount() {
  const { data, mutate } = useStore();
  const toast = useToast();

  const [brandId, setBrandId] = useState('');
  const [q, setQ] = useState('');
  const [filterDiscrepancy, setFilterDiscrepancy] = useState(false);

  // Map of productId -> actualQty input (string)
  const [actuals, setActuals] = useState<Record<string, string>>({});
  // Map of productId -> reason
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [commonReason] = useState('خطأ في التسجيل السابق');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const brandName = (id: string) => data.brands.find((b) => b.id === id)?.name ?? '';

  const rows = useMemo(() => {
    const list = data.products.filter(
      (p) =>
        (!brandId || p.brandId === brandId) &&
        matchesQuery(`${brandName(p.brandId)} ${p.name} ${p.size} ${p.color} ${p.sku}`, q),
    );
    return sortProducts(data, list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, brandId, q]);

  // Count items with differences
  const diffItems = useMemo(() => {
    const list: { product: Product; actual: number; diff: number; reason: string }[] = [];
    for (const p of data.products) {
      const val = actuals[p.id];
      if (val !== undefined && val.trim() !== '' && !isNaN(Number(val))) {
        const actualNum = Math.max(0, Math.round(Number(val)));
        const diff = actualNum - p.qty;
        if (diff !== 0) {
          list.push({ product: p, actual: actualNum, diff, reason: reasons[p.id] || commonReason });
        }
      }
    }
    return list;
  }, [data.products, actuals, reasons, commonReason]);

  const displayedRows = useMemo(() => {
    if (!filterDiscrepancy) return rows;
    const diffProductIds = new Set(diffItems.map((d) => d.product.id));
    return rows.filter((p) => diffProductIds.has(p.id));
  }, [rows, filterDiscrepancy, diffItems]);

  const setAllAsSystem = () => {
    if (!window.confirm('هل تريد ملء الكمية الفعلية لجميع المنتجات المعروضة بنفس رصيد النظام؟')) return;
    const next = { ...actuals };
    displayedRows.forEach((p) => {
      next[p.id] = String(p.qty);
    });
    setActuals(next);
  };

  const clearAll = () => {
    setActuals({});
    setReasons({});
  };

  const handleApplyBatch = () => {
    if (diffItems.length === 0) {
      toast('لا توجد أي فروقات مسجلة للحفظ', 'warning');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من تطبيق فروقات الجرد لـ ${diffItems.length} منتج؟ سيتم تسجيل الحركات في النظام.`)) {
      return;
    }

    setIsSubmitting(true);
    const r = mutate((current) => {
      let working = current;
      for (const item of diffItems) {
        const moveRes = applyMovement(working, {
          type: item.diff < 0 ? 'missing' : 'received',
          productId: item.product.id,
          qty: Math.abs(item.diff),
          date: todayStr(),
          user: working.settings.userName,
          notes: `جرد شامل (${item.diff < 0 ? 'نقص' : 'زيادة'}): ${item.reason}`,
        });
        if (!moveRes.ok) return moveRes;
        working = moveRes.data;
      }
      return { ok: true as const, data: working, updated: diffItems.length };
    });

    setIsSubmitting(false);
    if (!r.ok) {
      toast(r.error, 'danger');
    } else {
      toast(`تم تطبيق الجرد بنجاح لـ ${diffItems.length} منتج`);
      clearAll();
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-4">
            <div className="input-group">
              <span className="input-group-text bg-white">
                <i className="bi bi-search" />
              </span>
              <input
                className="form-control"
                placeholder="بحث بالمنتج أو العلامة أو المقاس..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="col-6 col-md-3">
            <select className="form-select" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">كل العلامات</option>
              {data.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <div className="form-check">
              <input
                id="onlyDiff"
                type="checkbox"
                className="form-check-input"
                checked={filterDiscrepancy}
                onChange={(e) => setFilterDiscrepancy(e.target.checked)}
              />
              <label htmlFor="onlyDiff" className="form-check-label small">
                الفروقات فقط ({diffItems.length})
              </label>
            </div>
          </div>
          <div className="col-12 col-md-3 d-flex justify-content-md-end gap-1">
            <button className="btn btn-sm btn-outline-secondary" onClick={setAllAsSystem} title="ملء الكل برصيد النظام">
              مطابقة الكل
            </button>
            <button className="btn btn-sm btn-outline-danger" onClick={clearAll} title="تفريغ الخانات">
              تفريغ
            </button>
          </div>
        </div>
      </div>

      <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light sticky-top">
            <tr>
              <th style={{ width: 44 }}>الصورة</th>
              <th>المنتج</th>
              <th>المقاس / اللون</th>
              <th>العلامة</th>
              <th className="text-center" style={{ width: 110 }}>رصيد النظام</th>
              <th className="text-center" style={{ width: 140 }}>الفعلي بالجرد</th>
              <th className="text-center" style={{ width: 110 }}>الفرق</th>
              <th style={{ minWidth: 160 }}>سبب الفرق</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-muted">
                  لا توجد نتائج مطابقة
                </td>
              </tr>
            ) : (
              displayedRows.map((p) => {
                const actStr = actuals[p.id] ?? '';
                const hasAct = actStr.trim() !== '' && !isNaN(Number(actStr));
                const actVal = hasAct ? Math.max(0, Math.round(Number(actStr))) : null;
                const diff = actVal !== null ? actVal - p.qty : null;

                return (
                  <tr key={p.id} className={diff !== null && diff !== 0 ? (diff < 0 ? 'table-danger-subtle' : 'table-success-subtle') : ''}>
                    <td>
                      <ProductImage src={p.image} size={36} />
                    </td>
                    <td className="fw-semibold">
                      {p.name}
                      {p.sku && <div className="small text-muted font-monospace">{p.sku}</div>}
                    </td>
                    <td>{variantLabel(p.size, p.color) || '—'}</td>
                    <td>{brandName(p.brandId)}</td>
                    <td className="text-center fw-bold fs-6">{p.qty}</td>
                    <td className="text-center">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder={String(p.qty)}
                        className="form-control form-control-sm text-center fw-bold"
                        value={actStr}
                        onChange={(e) => setActuals({ ...actuals, [p.id]: e.target.value })}
                      />
                    </td>
                    <td className="text-center fw-bold" dir="ltr">
                      {diff === null ? (
                        <span className="text-muted">—</span>
                      ) : diff === 0 ? (
                        <span className="text-success"><i className="bi bi-check-circle me-1" />0</span>
                      ) : (
                        <span className={`badge ${diff < 0 ? 'bg-danger' : 'bg-success'}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </td>
                    <td>
                      {diff !== null && diff !== 0 ? (
                        <select
                          className="form-select form-select-sm"
                          value={reasons[p.id] || ''}
                          onChange={(e) => setReasons({ ...reasons, [p.id]: e.target.value })}
                        >
                          <option value="">(افتراضي: {commonReason})</option>
                          {(diff < 0 ? SHORTAGE_REASONS : SURPLUS_REASONS).map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="card-footer d-flex flex-wrap align-items-center justify-content-between gap-3 bg-light">
        <div className="small">
          <span>إجمالي المنتجات: <b>{displayedRows.length}</b></span>
          <span className="ms-3">
            الفروقات: <b className={diffItems.length > 0 ? 'text-danger' : 'text-success'}>{diffItems.length} منتج</b>
          </span>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-success px-4"
            disabled={diffItems.length === 0 || isSubmitting}
            onClick={handleApplyBatch}
          >
            <i className="bi bi-check2-all me-1" />
            حفظ واعتماد الجرد ({diffItems.length} تعديل)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- */
/* 2. الجرد الفردي البسيط (Single Product Quick Count)           */
/* ------------------------------------------------------------- */

function SingleStockCount() {
  const { data, mutate } = useStore();
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [actual, setActual] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const product = data.products.find((p) => p.id === productId);
  const brandName = product ? data.brands.find((b) => b.id === product.brandId)?.name : '';
  const hasActual = actual.trim() !== '' && Number.isInteger(Number(actual)) && Number(actual) >= 0;
  const actualNum = hasActual ? Number(actual) : null;
  const diff = product && actualNum !== null ? actualNum - product.qty : null;
  const reasons = diff !== null && diff > 0 ? SURPLUS_REASONS : SHORTAGE_REASONS;

  const pick = (id: string) => {
    setProductId(id);
    setActual('');
    setReason('');
    setNotes('');
    setError('');
  };

  const record = () => {
    if (!product || diff === null || diff === 0) return;
    if (!reason) {
      setError('اختر السبب أولاً');
      return;
    }
    const r = mutate((d) =>
      applyMovement(d, {
        type: diff < 0 ? 'missing' : 'received',
        productId: product.id,
        qty: Math.abs(diff),
        date: todayStr(),
        user: d.settings.userName,
        notes: `جرد (${diff < 0 ? 'نقص' : 'زيادة'}): ${reason}${notes.trim() ? ' — ' + notes.trim() : ''}`,
      }),
    );
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast(`تم تحديث الرصيد إلى ${actualNum}`);
    pick('');
  };

  return (
    <div className="card" style={{ maxWidth: 760 }}>
      <div className="card-body">
        {data.products.length === 0 ? (
          <div className="text-secondary">
            لا توجد منتجات للجرد. أضف منتجات من صفحة <a href="#/inventory">المخزون</a>.
          </div>
        ) : (
          <>
            <label className="form-label small text-secondary">اختر المنتج للجرد</label>
            <ProductPicker value={productId} onChange={pick} />

            {product && (
              <>
                <div className="d-flex align-items-center gap-3 my-3 p-3 bg-light rounded border">
                  <ProductImage src={product.image} size={50} />
                  <div>
                    <h5 className="mb-0 fw-bold">{product.name}</h5>
                    <div className="small text-secondary">
                      {brandName} · {variantLabel(product.size, product.color) || 'بدون مقاس/لون'}
                      {product.sku && <span className="ms-2 font-monospace">({product.sku})</span>}
                    </div>
                  </div>
                </div>

                <div className="count-grid my-4">
                  <div className="count-box">
                    <div className="small text-secondary">رصيد النظام</div>
                    <div className="fs-2 fw-bold">{product.qty}</div>
                  </div>
                  <div className="count-box">
                    <div className="small text-secondary">الكمية الفعلية</div>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      autoFocus
                      className="form-control form-control-lg text-center fw-bold"
                      value={actual}
                      onChange={(e) => {
                        setActual(e.target.value);
                        setReason('');
                        setError('');
                      }}
                    />
                  </div>
                  <div
                    className={`count-box ${
                      diff === null ? '' : diff < 0 ? 'bad' : diff > 0 ? 'warn' : 'good'
                    }`}
                  >
                    <div className="small text-secondary">الفرق</div>
                    <div className="fs-2 fw-bold" dir="ltr">
                      {diff === null ? '—' : diff > 0 ? `+${diff}` : diff}
                    </div>
                  </div>
                </div>

                {diff === 0 && <div className="alert alert-success py-2 mb-0">الرصيد مطابق، لا يلزم أي تعديل. ✓</div>}

                {diff !== null && diff !== 0 && (
                  <div className="border rounded p-3 bg-light">
                    <div className="fw-bold mb-2">
                      {diff < 0 ? `يوجد عجز ${-diff} قطعة` : `يوجد زيادة ${diff} قطعة`}
                    </div>
                    <div className="row g-2">
                      <div className="col-12 col-md-5">
                        <label className="form-label small text-secondary">السبب</label>
                        <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                          <option value="">اختر السبب...</option>
                          {reasons.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-md-7">
                        <label className="form-label small text-secondary">ملاحظات (اختياري)</label>
                        <input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
                      </div>
                    </div>
                    {error && <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div>}
                    <div className="d-flex justify-content-between align-items-center mt-3 gap-2 flex-wrap">
                      <span className="small text-secondary">
                        {diff < 0
                          ? 'سيُسجَّل كحركة «مفقود» ويُحدَّث الرصيد.'
                          : 'سيُسجَّل كحركة «استلام» ويُحدَّث الرصيد.'}
                      </span>
                      <button className={`btn ${diff < 0 ? 'btn-danger' : 'btn-success'}`} onClick={record}>
                        {diff < 0 ? 'تسجيل العجز وتحديث الرصيد' : 'تسجيل الزيادة وتحديث الرصيد'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
