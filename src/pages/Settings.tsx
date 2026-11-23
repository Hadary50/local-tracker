import { useRef, useState, type FormEvent } from 'react';
import { useStore } from '../store';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import { emptyData, sanitizeData, todayStr } from '../lib/logic';

export default function Settings() {
  const { data, replaceAll } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [shopName, setShopName] = useState(data.settings.shopName);
  const [userName, setUserName] = useState(data.settings.userName);
  const [threshold, setThreshold] = useState(String(data.settings.lowStockThreshold));

  const saveSettings = (e: FormEvent) => {
    e.preventDefault();
    const t = Number(threshold);
    if (!Number.isInteger(t) || t < 0) {
      toast('حد النقص يجب أن يكون عدداً صحيحاً (صفر أو أكثر)', 'danger');
      return;
    }
    replaceAll({
      ...data,
      settings: {
        shopName: shopName.trim() || data.settings.shopName,
        userName: userName.trim() || data.settings.userName,
        lowStockThreshold: t,
      },
    });
    toast('تم حفظ الإعدادات');
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-stock-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = sanitizeData(JSON.parse(await file.text()));
      if (!parsed) throw new Error('bad');
      if (
        !window.confirm(
          `سيتم استبدال كل البيانات الحالية بالنسخة الاحتياطية (${parsed.brands.length} علامة، ${parsed.products.length} منتج، ${parsed.movements.length} حركة). متابعة؟`,
        )
      )
        return;
      replaceAll(parsed);
      toast('تم استرجاع النسخة الاحتياطية');
    } catch {
      toast('الملف ليس نسخة احتياطية صالحة', 'danger');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const wipe = () => {
    if (!window.confirm('سيتم حذف كل العلامات والمنتجات والحركات نهائياً. هل أنت متأكد؟')) return;
    if (!window.confirm('تأكيد أخير: لا يمكن التراجع. حمّل نسخة احتياطية أولاً إن لم تكن قد فعلت. حذف كل شيء؟')) return;
    replaceAll({ ...emptyData(), settings: data.settings });
    toast('تم حذف كل البيانات', 'warning');
  };

  return (
    <>
      <PageHeader title="الإعدادات" />

      <div className="row g-4" style={{ maxWidth: 900 }}>
        <div className="col-12">
          <div className="card">
            <div className="card-header fw-bold">عام</div>
            <form className="card-body row g-3" onSubmit={saveSettings}>
              <div className="col-12 col-md-4">
                <label className="form-label small text-secondary">اسم المحل</label>
                <input className="form-control" value={shopName} onChange={(e) => setShopName(e.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small text-secondary">اسم المستخدم (يُسجَّل في كل حركة)</label>
                <input className="form-control" value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small text-secondary">حد تنبيه النقص (الكمية ≤)</label>
                <input
                  type="number"
                  min={0}
                  className="form-control"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </div>
              <div className="col-12">
                <button className="btn btn-primary" type="submit">
                  حفظ الإعدادات
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-12">
          <div className="card">
            <div className="card-header fw-bold">النسخ الاحتياطي</div>
            <div className="card-body">
              <p className="text-secondary small">
                البيانات متزامنة سحابياً مع قاعدة البيانات المركزية. يمكنك أيضاً تحميل نسخة احتياطية محلية بصيغة JSON كإجراء أمان إضافي أو لاسترجاعها في أي وقت.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-outline-dark" onClick={backup}>
                  <i className="bi bi-download me-1" /> تحميل نسخة احتياطية
                </button>
                <button className="btn btn-outline-dark" onClick={() => fileRef.current?.click()}>
                  <i className="bi bi-upload me-1" /> استرجاع نسخة
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => restore(e.target.files?.[0])}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card border-danger-subtle">
            <div className="card-header fw-bold text-danger">منطقة الخطر</div>
            <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span className="small text-secondary">حذف كل العلامات والمنتجات والحركات.</span>
              <button className="btn btn-outline-danger" onClick={wipe}>
                حذف كل البيانات
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
