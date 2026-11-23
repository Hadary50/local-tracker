import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../store';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { Empty, PageHeader, QtyBadge, variantLabel } from '../components/ui';
import { MovementModal } from '../components/MovementForm';
import ImportPage from './ImportPage';
import { addProduct, deleteProduct, matchesQuery, sortProducts, todayStr, updateProduct } from '../lib/logic';
import type { Route } from '../hooks/useRoute';
import type { Product } from '../types';

export default function Inventory({ route }: { route: Route }) {
  if (route.path[1] === 'import') return <ImportPage route={route} />;
  return <InventoryList route={route} />;
}

function InventoryList({ route }: { route: Route }) {
  const { data, mutate } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [brandId, setBrandId] = useState(route.query.get('brand') ?? '');
  const [lowOnly, setLowOnly] = useState(route.query.get('low') === '1');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [moveFor, setMoveFor] = useState<string | null>(null);

  const brandName = (id: string) => data.brands.find((b) => b.id === id)?.name ?? '';

  const rows = useMemo(() => {
    const list = data.products.filter(
      (p) =>
        (!brandId || p.brandId === brandId) &&
        (!lowOnly || p.qty <= data.settings.lowStockThreshold) &&
        matchesQuery(`${brandName(p.brandId)} ${p.name} ${p.size} ${p.color} ${p.sku}`, q),
    );
    return sortProducts(data, list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, brandId, lowOnly]);

  const totalQty = rows.reduce((s, p) => s + p.qty, 0);

  const remove = (p: Product) => {
    if (!window.confirm(`حذف "${p.name}"؟ سيبقى سجل حركاته في التقارير.`)) return;
    mutate((d) => deleteProduct(d, p.id));
    toast('تم حذف المنتج');
  };

  return (
    <>
      <PageHeader
        title="المخزون"
        subtitle="الكمية الحالية لكل منتج"
        actions={
          <>
            <a className="btn btn-outline-primary" href="#/inventory/import">
              <i className="bi bi-file-earmark-excel me-1" /> استيراد من Excel
            </a>
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <i className="bi bi-plus-lg me-1" /> إضافة منتج
            </button>
          </>
        }
      />

      <div className="card">
        <div className="card-header">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-5">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search" />
                </span>
                <input
                  className="form-control"
                  placeholder="بحث بالمنتج أو العلامة أو المقاس أو اللون أو SKU..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="col-7 col-md-3">
              <select className="form-select" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">كل العلامات</option>
                {data.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-5 col-md-4">
              <div className="form-check">
                <input
                  id="lowOnly"
                  type="checkbox"
                  className="form-check-input"
                  checked={lowOnly}
                  onChange={(e) => setLowOnly(e.target.checked)}
                />
                <label htmlFor="lowOnly" className="form-check-label small">
                  النقص فقط (≤ {data.settings.lowStockThreshold})
                </label>
              </div>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty text={data.products.length === 0 ? 'لا توجد منتجات بعد' : 'لا توجد نتائج مطابقة'}>
            {data.products.length === 0 && (
              <div className="d-flex gap-2 justify-content-center">
                <a className="btn btn-outline-primary btn-sm" href="#/inventory/import">
                  استيراد من Excel
                </a>
                <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
                  إضافة منتج
                </button>
              </div>
            )}
          </Empty>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>الصورة</th>
                  <th>المنتج</th>
                  <th>العلامة</th>
                  <th>المقاس</th>
                  <th>اللون</th>
                  <th>SKU</th>
                  <th className="text-center">الكمية الحالية</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image ? (
                        <a href={p.image} target="_blank" rel="noreferrer" title="عرض الصورة بالحجم الكامل">
                          <img
                            src={p.image}
                            alt=""
                            className="rounded object-fit-cover border shadow-sm"
                            style={{ width: 38, height: 38 }}
                            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                          />
                        </a>
                      ) : (
                        <div
                          className="bg-light rounded border d-flex align-items-center justify-content-center text-muted"
                          style={{ width: 38, height: 38 }}
                        >
                          <i className="bi bi-image small" />
                        </div>
                      )}
                    </td>
                    <td className="fw-semibold">{p.name}</td>
                    <td>{brandName(p.brandId)}</td>
                    <td>{p.size || '—'}</td>
                    <td>{p.color || '—'}</td>
                    <td className="text-secondary">{p.sku || '—'}</td>
                    <td className="text-center">
                      <QtyBadge qty={p.qty} />
                    </td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-outline-dark me-1" onClick={() => setMoveFor(p.id)}>
                        حركة
                      </button>
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setEditing(p)} title="تعديل">
                        <i className="bi bi-pencil" />
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(p)} title="حذف">
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="card-footer small text-secondary">
            {rows.length} منتج · إجمالي الكمية: <b>{totalQty}</b>
          </div>
        )}
      </div>

      {editing && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          defaultBrandId={brandId}
          onClose={() => setEditing(null)}
        />
      )}
      {moveFor && <MovementModal productId={moveFor} onClose={() => setMoveFor(null)} />}
    </>
  );
}

function ProductModal({
  product,
  defaultBrandId,
  onClose,
}: {
  product: Product | null;
  defaultBrandId: string;
  onClose: () => void;
}) {
  const { data, mutate } = useStore();
  const toast = useToast();
  const [brandId, setBrandId] = useState(product?.brandId ?? defaultBrandId);
  const [name, setName] = useState(product?.name ?? '');
  const [size, setSize] = useState(product?.size ?? '');
  const [color, setColor] = useState(product?.color ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [image, setImage] = useState(product?.image ?? '');
  const [opening, setOpening] = useState('0');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const fields = { name, size, color, sku, image };
    const r = product
      ? mutate((d) => updateProduct(d, product.id, fields))
      : mutate((d) => addProduct(d, { brandId, ...fields }, Number(opening) || 0, todayStr(), d.settings.userName));
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast(product ? 'تم تعديل المنتج' : 'تمت إضافة المنتج');
    onClose();
  };

  if (data.brands.length === 0) {
    return (
      <Modal title="إضافة منتج" onClose={onClose} size="sm">
        <p className="mb-3">أضف علامة تجارية أولاً.</p>
        <a className="btn btn-primary" href="#/brands" onClick={onClose}>
          الذهاب إلى العلامات
        </a>
      </Modal>
    );
  }

  return (
    <Modal title={product ? 'تعديل المنتج' : 'إضافة منتج'} onClose={onClose}>
      <form onSubmit={submit} className="row g-3">
        <div className="col-12">
          <label className="form-label small text-secondary">العلامة</label>
          <select
            className="form-select"
            value={brandId}
            disabled={!!product}
            onChange={(e) => setBrandId(e.target.value)}
          >
            <option value="">اختر العلامة...</option>
            {data.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12">
          <label className="form-label small text-secondary">اسم المنتج</label>
          <input className="form-control" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small text-secondary">المقاس</label>
          <input className="form-control" value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small text-secondary">اللون</label>
          <input className="form-control" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <div className="col-6">
          <label className="form-label small text-secondary">SKU (اختياري)</label>
          <input className="form-control" value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div className="col-12">
          <label className="form-label small text-secondary">رابط الصورة (اختياري)</label>
          <input
            className="form-control"
            placeholder="https://example.com/image.jpg"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />
        </div>
        {!product ? (
          <div className="col-6">
            <label className="form-label small text-secondary">الكمية الافتتاحية</label>
            <input
              type="number"
              min={0}
              step={1}
              className="form-control"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </div>
        ) : (
          <div className="col-6 d-flex align-items-end">
            <div className="form-text mb-2">تتغير الكمية من خلال حركات المخزون فقط.</div>
          </div>
        )}
        {error && (
          <div className="col-12">
            <div className="alert alert-danger py-2 mb-0">{error}</div>
          </div>
        )}
        <div className="col-12 d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-light" onClick={onClose}>
            إلغاء
          </button>
          <button type="submit" className="btn btn-primary">
            حفظ
          </button>
        </div>
      </form>
    </Modal>
  );
}
