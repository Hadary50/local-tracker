import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Empty, PageHeader, QtyBadge, variantLabel } from '../components/ui';
import MovementsTable from '../components/MovementsTable';
import { exportWorkbook } from '../lib/excel';
import {
  brandStats,
  describeMovement,
  filterMovements,
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  sortProducts,
  todayStr,
} from '../lib/logic';
import type { Movement, MovementType } from '../types';

type Tab = 'stock' | 'sold' | 'missing' | 'history';

const TABS: { key: Tab; label: string }[] = [
  { key: 'stock', label: 'المخزون الحالي حسب العلامة' },
  { key: 'sold', label: 'المبيعات' },
  { key: 'missing', label: 'المفقودات' },
  { key: 'history', label: 'سجل الحركات' },
];

export default function Reports() {
  const { data } = useStore();
  const [tab, setTab] = useState<Tab>('stock');
  const [brandId, setBrandId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<MovementType | ''>('');

  const showDates = tab !== 'stock';

  /* ---- stock tab ---- */
  const summary = useMemo(
    () => brandStats(data).filter((s) => !brandId || s.brand.id === brandId),
    [data, brandId],
  );
  const products = useMemo(
    () =>
      sortProducts(
        data,
        data.products.filter((p) => !brandId || p.brandId === brandId),
      ),
    [data, brandId],
  );
  const brandName = (id: string) => data.brands.find((b) => b.id === id)?.name ?? '';

  /* ---- movement tabs ---- */
  const movements = useMemo(() => {
    if (tab === 'stock') return [];
    const t: MovementType | '' = tab === 'sold' ? 'sold' : tab === 'missing' ? 'missing' : type;
    return filterMovements(data, { type: t, brandId, from, to });
  }, [data, tab, brandId, from, to, type]);
  const movementTotal = movements.reduce((s, m) => s + m.qty, 0);

  /* ---- export ---- */
  const movementRows = (list: Movement[]) =>
    list.map((m) => {
      const d = describeMovement(data, m);
      return [m.date, MOVEMENT_LABELS[m.type], d.brandName, d.productName, d.size, d.color, m.qty, m.user, m.notes];
    });
  const movementHeaders = ['التاريخ', 'النوع', 'العلامة', 'المنتج', 'المقاس', 'اللون', 'الكمية', 'المستخدم', 'ملاحظات'];

  const exportExcel = () => {
    const stamp = todayStr();
    if (tab === 'stock') {
      exportWorkbook(`المخزون-الحالي-${stamp}.xlsx`, [
        {
          name: 'ملخص العلامات',
          headers: ['العلامة', 'عدد المنتجات', 'المخزون الحالي', 'المباع', 'المفقود', 'المرتجع'],
          rows: summary.map((s) => [s.brand.name, s.products, s.stock, s.sold, s.missing, s.returned]),
        },
        {
          name: 'تفاصيل المنتجات',
          headers: ['العلامة', 'المنتج', 'المقاس', 'اللون', 'SKU', 'الكمية الحالية'],
          rows: products.map((p) => [brandName(p.brandId), p.name, p.size, p.color, p.sku, p.qty]),
        },
      ]);
      return;
    }
    const names: Record<Tab, string> = {
      stock: '',
      sold: 'المبيعات',
      missing: 'المفقودات',
      history: 'سجل-الحركات',
    };
    exportWorkbook(`${names[tab]}-${stamp}.xlsx`, [
      { name: names[tab].replace('-', ' '), headers: movementHeaders, rows: movementRows(movements) },
    ]);
  };

  const canExport = tab === 'stock' ? products.length > 0 : movements.length > 0;

  return (
    <>
      <PageHeader
        title="التقارير"
        actions={
          <button className="btn btn-success" disabled={!canExport} onClick={exportExcel}>
            <i className="bi bi-file-earmark-excel me-1" /> تصدير إلى Excel
          </button>
        }
      />

      <ul className="nav nav-pills mb-3 gap-1 flex-wrap">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key}>
            <button className={`nav-link${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="card">
        <div className="card-header">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label small text-secondary mb-1">العلامة</label>
              <select className="form-select" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">كل العلامات</option>
                {data.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {tab === 'history' && (
              <div className="col-6 col-md-2">
                <label className="form-label small text-secondary mb-1">النوع</label>
                <select className="form-select" value={type} onChange={(e) => setType(e.target.value as MovementType | '')}>
                  <option value="">الكل</option>
                  {MOVEMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MOVEMENT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showDates && (
              <>
                <div className="col-6 col-md-2">
                  <label className="form-label small text-secondary mb-1">من تاريخ</label>
                  <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small text-secondary mb-1">إلى تاريخ</label>
                  <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </div>

        {tab === 'stock' ? (
          products.length === 0 ? (
            <Empty text="لا توجد بيانات" />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>العلامة</th>
                      <th className="text-center">المنتجات</th>
                      <th className="text-center">المخزون الحالي</th>
                      <th className="text-center">المباع</th>
                      <th className="text-center">المفقود</th>
                      <th className="text-center">المرتجع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s) => (
                      <tr key={s.brand.id}>
                        <td className="fw-semibold">{s.brand.name}</td>
                        <td className="text-center">{s.products}</td>
                        <td className="text-center fw-bold">{s.stock}</td>
                        <td className="text-center">{s.sold}</td>
                        <td className="text-center">{s.missing}</td>
                        <td className="text-center">{s.returned}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-light fw-bold">
                      <td>الإجمالي</td>
                      <td className="text-center">{summary.reduce((s, x) => s + x.products, 0)}</td>
                      <td className="text-center">{summary.reduce((s, x) => s + x.stock, 0)}</td>
                      <td className="text-center">{summary.reduce((s, x) => s + x.sold, 0)}</td>
                      <td className="text-center">{summary.reduce((s, x) => s + x.missing, 0)}</td>
                      <td className="text-center">{summary.reduce((s, x) => s + x.returned, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="card-header border-top fw-bold">تفاصيل المنتجات</div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>العلامة</th>
                      <th>المنتج</th>
                      <th>المقاس / اللون</th>
                      <th>SKU</th>
                      <th className="text-center">الكمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>{brandName(p.brandId)}</td>
                        <td className="fw-semibold">{p.name}</td>
                        <td>{variantLabel(p.size, p.color) || '—'}</td>
                        <td className="text-secondary">{p.sku || '—'}</td>
                        <td className="text-center">
                          <QtyBadge qty={p.qty} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : (
          <>
            <MovementsTable movements={movements} pageSize={100} emptyText="لا توجد حركات في هذه الفترة" />
            {movements.length > 0 && (
              <div className="card-footer small text-secondary">
                {movements.length} حركة · إجمالي الكمية: <b>{movementTotal}</b>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
