import { useState } from 'react';
import { useStore } from '../store';
import { useToast } from '../components/Toast';
import ProductPicker from '../components/ProductPicker';
import { PageHeader } from '../components/ui';
import { applyMovement, todayStr } from '../lib/logic';

const SHORTAGE_REASONS = ['مفقود / لم يُعثر عليه', 'سرقة', 'تالف', 'خطأ في التسجيل السابق', 'أخرى'];
const SURPLUS_REASONS = ['وُجد في المخزن', 'خطأ في التسجيل السابق', 'مرتجع لم يُسجَّل', 'أخرى'];

export default function StockCount() {
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
    <>
      <PageHeader title="الجرد البسيط" subtitle="اكتب الكمية التي وجدتها فعلياً وقارنها برصيد النظام" />

      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-body">
          {data.products.length === 0 ? (
            <div className="text-secondary">
              لا توجد منتجات للجرد. أضف منتجات من صفحة <a href="#/inventory">المخزون</a>.
            </div>
          ) : (
            <>
              <label className="form-label small text-secondary">المنتج</label>
              <ProductPicker value={productId} onChange={pick} />

              {product && (
                <>
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

                  <div className="small text-secondary mb-3">
                    {product.name}
                    {brandName ? ` — ${brandName}` : ''}
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
    </>
  );
}
