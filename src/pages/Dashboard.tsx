import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { filterMovements, sortProducts, totals } from '../lib/logic';
import { Empty, PageHeader, QtyBadge, StatCard, variantLabel } from '../components/ui';
import MovementsTable from '../components/MovementsTable';
import { MovementModal } from '../components/MovementForm';

export default function Dashboard() {
  const { data } = useStore();
  const [receiveFor, setReceiveFor] = useState<string | null>(null);

  const t = useMemo(() => totals(data), [data]);
  const alerts = useMemo(
    () =>
      sortProducts(
        data,
        data.products.filter((p) => p.qty <= data.settings.lowStockThreshold),
      ).sort((a, b) => a.qty - b.qty),
    [data],
  );
  const recent = useMemo(() => filterMovements(data, {}).slice(0, 8), [data]);
  const brandName = (id: string) => data.brands.find((b) => b.id === id)?.name ?? '';

  const isFresh = data.brands.length === 0 && data.products.length === 0;

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle={data.settings.shopName} />

      {isFresh && (
        <div className="card mb-4 border-primary-subtle bg-primary-subtle bg-opacity-25">
          <div className="card-body">
            <div className="fw-bold mb-2">ابدأ في 3 خطوات</div>
            <ol className="mb-3 ps-3">
              <li>
                أضف العلامات التجارية من صفحة <a href="#/brands">العلامات</a>.
              </li>
              <li>
                استورد ملف Excel لكل علامة من صفحة <a href="#/inventory">المخزون</a>.
              </li>
              <li>
                سجّل المبيعات والمفقودات من <a href="#/movements">حركات المخزون</a>.
              </li>
            </ol>
            <a className="btn btn-primary btn-sm" href="#/brands">
              إضافة أول علامة
            </a>
          </div>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard label="إجمالي المخزون الحالي" value={t.stock} icon="bi-box-seam" tone="primary" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="إجمالي المبيع" value={t.sold} icon="bi-bag-check" tone="success" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="عدد العلامات" value={data.brands.length} icon="bi-tags" tone="secondary" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard
            label="تنبيهات النقص"
            value={alerts.length}
            icon="bi-exclamation-triangle"
            tone={alerts.length > 0 ? 'danger' : 'success'}
          />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-5">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span className="fw-bold">تنبيهات النقص</span>
              <span className="small text-secondary">الرصيد ≤ {data.settings.lowStockThreshold}</span>
            </div>
            {alerts.length === 0 ? (
              <Empty text="لا توجد منتجات ناقصة 🎉" />
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <tbody>
                    {alerts.slice(0, 8).map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="fw-semibold">{p.name}</div>
                          <div className="small text-secondary">
                            {[brandName(p.brandId), variantLabel(p.size, p.color)].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td className="text-center">
                          <QtyBadge qty={p.qty} />
                        </td>
                        <td className="text-end">
                          <button className="btn btn-sm btn-outline-success" onClick={() => setReceiveFor(p.id)}>
                            استلام
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {alerts.length > 8 && (
              <div className="card-footer text-center">
                <a href="#/inventory?low=1" className="small">
                  عرض كل المنتجات الناقصة ({alerts.length})
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span className="fw-bold">آخر الحركات</span>
              <a href="#/movements" className="small">
                عرض الكل
              </a>
            </div>
            <MovementsTable movements={recent} emptyText="لم تُسجَّل أي حركة بعد" />
          </div>
        </div>
      </div>

      {receiveFor && <MovementModal productId={receiveFor} type="received" onClose={() => setReceiveFor(null)} />}
    </>
  );
}
