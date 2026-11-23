import { useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../store';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { Empty, PageHeader, ProductImage, QtyBadge, StatCard, variantLabel } from '../components/ui';
import { MovementModal } from '../components/MovementForm';
import { addBrand, brandStats, deleteBrand, matchesQuery, renameBrand, sortProducts } from '../lib/logic';
import type { Route } from '../hooks/useRoute';
import { go } from '../hooks/useRoute';
import type { Brand } from '../types';

export default function Brands({ route }: { route: Route }) {
  const id = route.path[1];
  return id ? <BrandDetail brandId={id} /> : <BrandList />;
}

/* ---------------------------- list ---------------------------- */

function BrandList() {
  const { data, mutate } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Brand | 'new' | null>(null);
  const stats = useMemo(() => brandStats(data), [data]);

  const remove = (b: Brand, count: number) => {
    let msg = `حذف العلامة "${b.name}"؟`;
    if (count > 0) {
      msg = `العلامة "${b.name}" تحتوي على ${count} منتج. هل أنت متأكد من حذف العلامة وكافة منتجاتها؟`;
    }
    if (!window.confirm(msg)) return;
    const r = mutate((d) => deleteBrand(d, b.id, true));
    if (!r.ok) toast(r.error, 'danger');
    else toast('تم حذف العلامة ومنتجاتها');
  };

  return (
    <>
      <PageHeader
        title="العلامات التجارية"
        subtitle="كل علامة وما لديها من مخزون ومبيعات ومفقودات"
        actions={
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <i className="bi bi-plus-lg me-1" /> إضافة علامة
          </button>
        }
      />

      <div className="card">
        {stats.length === 0 ? (
          <Empty text="لم تُضف أي علامة بعد">
            <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
              إضافة أول علامة
            </button>
          </Empty>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>العلامة</th>
                  <th className="text-center">المنتجات</th>
                  <th className="text-center">المخزون الحالي</th>
                  <th className="text-center">المباع</th>
                  <th className="text-center">المفقود</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.brand.id} className="clickable" onClick={() => go(`/brands/${s.brand.id}`)}>
                    <td className="fw-semibold">{s.brand.name}</td>
                    <td className="text-center">{s.products}</td>
                    <td className="text-center fw-semibold">{s.stock}</td>
                    <td className="text-center">{s.sold}</td>
                    <td className="text-center">{s.missing}</td>
                    <td className="text-end text-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setEditing(s.brand)}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        title={s.products > 0 ? `حذف العلامة و ${s.products} منتج تابع لها` : 'حذف'}
                        onClick={() => remove(s.brand, s.products)}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <BrandModal brand={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function BrandModal({ brand, onClose }: { brand: Brand | null; onClose: () => void }) {
  const { mutate } = useStore();
  const toast = useToast();
  const [name, setName] = useState(brand?.name ?? '');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = brand ? mutate((d) => renameBrand(d, brand.id, name)) : mutate((d) => addBrand(d, name));
    if (!r.ok) {
      setError(r.error);
      return;
    }
    toast(brand ? 'تم تعديل العلامة' : 'تمت إضافة العلامة');
    onClose();
  };

  return (
    <Modal title={brand ? 'تعديل العلامة' : 'إضافة علامة'} onClose={onClose} size="sm">
      <form onSubmit={submit}>
        <label className="form-label small text-secondary">اسم العلامة</label>
        <input className="form-control mb-2" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <div className="d-flex justify-content-end gap-2 mt-3">
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

/* --------------------------- detail --------------------------- */

function BrandDetail({ brandId }: { brandId: string }) {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const [moveFor, setMoveFor] = useState<string | null>(null);

  const stat = useMemo(() => brandStats(data).find((s) => s.brand.id === brandId), [data, brandId]);
  const products = useMemo(
    () =>
      sortProducts(
        data,
        data.products.filter((p) => p.brandId === brandId && matchesQuery(`${p.name} ${p.size} ${p.color} ${p.sku}`, q)),
      ),
    [data, brandId, q],
  );

  if (!stat) {
    return (
      <Empty text="العلامة غير موجودة">
        <a href="#/brands">العودة إلى العلامات</a>
      </Empty>
    );
  }

  return (
    <>
      <PageHeader
        title={stat.brand.name}
        subtitle="منتجات ومخزون هذه العلامة"
        actions={
          <>
            <a className="btn btn-light" href="#/brands">
              <i className="bi bi-arrow-right me-1" /> رجوع
            </a>
            <button className="btn btn-outline-secondary" onClick={() => setEditing(true)}>
              <i className="bi bi-pencil me-1" /> تعديل الاسم
            </button>
            <a className="btn btn-primary" href={`#/inventory/import?brand=${stat.brand.id}`}>
              <i className="bi bi-upload me-1" /> استيراد من Excel
            </a>
          </>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard label="المنتجات" value={stat.products} icon="bi-tag" tone="secondary" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="المخزون الحالي" value={stat.stock} icon="bi-box-seam" tone="primary" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="المباع" value={stat.sold} icon="bi-bag-check" tone="success" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="المفقود" value={stat.missing} icon="bi-question-circle" tone="danger" />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <input
            className="form-control"
            style={{ maxWidth: 360 }}
            placeholder="بحث في منتجات العلامة..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {products.length === 0 ? (
          <Empty text={q ? 'لا توجد نتائج' : 'لا توجد منتجات لهذه العلامة بعد'} />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>الصورة</th>
                  <th>المنتج</th>
                  <th>المقاس / اللون</th>
                  <th>SKU</th>
                  <th className="text-center">الكمية</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <ProductImage src={p.image} size={34} />
                    </td>
                    <td className="fw-semibold">{p.name}</td>
                    <td>{variantLabel(p.size, p.color) || '—'}</td>
                    <td className="text-secondary">{p.sku || '—'}</td>
                    <td className="text-center">
                      <QtyBadge qty={p.qty} />
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-dark" onClick={() => setMoveFor(p.id)}>
                        تسجيل حركة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <BrandModal brand={stat.brand} onClose={() => setEditing(false)} />}
      {moveFor && <MovementModal productId={moveFor} onClose={() => setMoveFor(null)} />}
    </>
  );
}
