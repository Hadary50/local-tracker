import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { PageHeader } from '../components/ui';
import MovementForm from '../components/MovementForm';
import MovementsTable from '../components/MovementsTable';
import { filterMovements, MOVEMENT_LABELS, MOVEMENT_TYPES } from '../lib/logic';
import type { MovementType } from '../types';

export default function Movements() {
  const { data } = useStore();
  const [type, setType] = useState<MovementType | ''>('');
  const [brandId, setBrandId] = useState('');
  const [q, setQ] = useState('');

  const list = useMemo(() => filterMovements(data, { type, brandId, q }), [data, type, brandId, q]);

  return (
    <>
      <PageHeader title="حركات المخزون" subtitle="سجّل الاستلام والمبيع والمفقود والمرتجع — يتحدث المخزون تلقائياً" />

      <div className="card mb-4">
        <div className="card-header fw-bold">حركة جديدة</div>
        <div className="card-body">
          {data.products.length === 0 ? (
            <div className="text-secondary">
              أضف منتجات أولاً من صفحة <a href="#/inventory">المخزون</a>.
            </div>
          ) : (
            <MovementForm />
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-4">
              <input className="form-control" placeholder="بحث في السجل..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select" value={type} onChange={(e) => setType(e.target.value as MovementType | '')}>
                <option value="">كل الأنواع</option>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MOVEMENT_LABELS[t]}
                  </option>
                ))}
              </select>
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
          </div>
        </div>
        <MovementsTable movements={list} pageSize={50} emptyText="لا توجد حركات مطابقة" />
      </div>
    </>
  );
}
