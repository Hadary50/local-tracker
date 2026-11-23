import { useState, type FormEvent } from 'react';
import { useStore } from '../store';
import { useToast } from './Toast';
import ProductPicker from './ProductPicker';
import Modal from './Modal';
import { applyMovement, MOVEMENT_LABELS, MOVEMENT_SIGN, MOVEMENT_TYPES, todayStr } from '../lib/logic';
import type { MovementType } from '../types';

const TYPE_BTN: Record<MovementType, string> = {
  received: 'success',
  sold: 'primary',
  missing: 'danger',
  returned: 'warning',
};

const TYPE_HINT: Record<MovementType, string> = {
  received: 'تزيد الرصيد',
  sold: 'تنقص الرصيد',
  missing: 'تنقص الرصيد',
  returned: 'تزيد الرصيد (مرتجع إلى المخزون)',
};

interface Props {
  defaultProductId?: string;
  defaultType?: MovementType;
  lockProduct?: boolean;
  onDone?: () => void;
}

export default function MovementForm({ defaultProductId = '', defaultType = 'sold', lockProduct, onDone }: Props) {
  const { data, mutate } = useStore();
  const toast = useToast();
  const [type, setType] = useState<MovementType>(defaultType);
  const [productId, setProductId] = useState(defaultProductId);
  const [qty, setQty] = useState('1');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const product = data.products.find((p) => p.id === productId);
  const qtyNum = Number(qty);
  const after = product && Number.isFinite(qtyNum) ? product.qty + MOVEMENT_SIGN[type] * qtyNum : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = mutate((d) =>
      applyMovement(d, { type, productId, qty: qtyNum, date, notes, user: d.settings.userName }),
    );
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast(`تم تسجيل ${MOVEMENT_LABELS[type]}: ${qtyNum} × ${product?.name ?? ''}`);
    setError('');
    setQty('1');
    setNotes('');
    if (!lockProduct) setProductId('');
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="row g-3">
      <div className="col-12">
        <label className="form-label small text-secondary">نوع الحركة</label>
        <div className="btn-group w-100" role="group">
          {MOVEMENT_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              className={`btn btn-${type === t ? '' : 'outline-'}${TYPE_BTN[t]}`}
              onClick={() => setType(t)}
            >
              {MOVEMENT_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="form-text">{TYPE_HINT[type]}</div>
      </div>

      <div className="col-12">
        <label className="form-label small text-secondary">المنتج</label>
        <ProductPicker value={productId} onChange={setProductId} disabled={lockProduct} />
        {product && (
          <div className="form-text">
            الرصيد الحالي: <b>{product.qty}</b>
            {after !== null && qtyNum > 0 && (
              <>
                {' '}
                ← بعد الحركة: <b className={after < 0 ? 'text-danger' : ''}>{after}</b>
              </>
            )}
          </div>
        )}
      </div>

      <div className="col-6 col-md-3">
        <label className="form-label small text-secondary">الكمية</label>
        <input
          type="number"
          min={1}
          step={1}
          className="form-control"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </div>
      <div className="col-6 col-md-3">
        <label className="form-label small text-secondary">التاريخ</label>
        <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="col-12 col-md-6">
        <label className="form-label small text-secondary">ملاحظات (اختياري)</label>
        <input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && (
        <div className="col-12">
          <div className="alert alert-danger py-2 mb-0">{error}</div>
        </div>
      )}

      <div className="col-12 d-flex align-items-center justify-content-between gap-2">
        <span className="small text-secondary">
          المستخدم: <b>{data.settings.userName}</b>
        </span>
        <button type="submit" className="btn btn-dark px-4">
          <i className="bi bi-check2 me-1" /> تسجيل الحركة
        </button>
      </div>
    </form>
  );
}

export function MovementModal({
  productId,
  type,
  onClose,
}: {
  productId: string;
  type?: MovementType;
  onClose: () => void;
}) {
  return (
    <Modal title="تسجيل حركة مخزون" onClose={onClose}>
      <MovementForm defaultProductId={productId} defaultType={type} lockProduct onDone={onClose} />
    </Modal>
  );
}
