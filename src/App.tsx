import { useEffect, useState } from 'react';
import { useRoute } from './hooks/useRoute';
import { useStore } from './store';
import Dashboard from './pages/Dashboard';
import Brands from './pages/Brands';
import Inventory from './pages/Inventory';
import Movements from './pages/Movements';
import StockCount from './pages/StockCount';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const NAV = [
  { key: 'dashboard', href: '#/', label: 'لوحة التحكم', icon: 'bi-speedometer2' },
  { key: 'brands', href: '#/brands', label: 'العلامات', icon: 'bi-tags' },
  { key: 'inventory', href: '#/inventory', label: 'المخزون', icon: 'bi-box-seam' },
  { key: 'movements', href: '#/movements', label: 'حركات المخزون', icon: 'bi-arrow-left-right' },
  { key: 'count', href: '#/count', label: 'الجرد', icon: 'bi-clipboard-check' },
  { key: 'reports', href: '#/reports', label: 'التقارير', icon: 'bi-file-earmark-bar-graph' },
  { key: 'settings', href: '#/settings', label: 'الإعدادات', icon: 'bi-gear' },
];

export default function App() {
  const route = useRoute();
  const { data, saveFailed } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const page = route.path[0] ?? 'dashboard';

  // close the mobile menu and scroll to top when navigating
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [route.path.join('/')]);

  let content;
  switch (page) {
    case 'brands':
      content = <Brands route={route} />;
      break;
    case 'inventory':
      content = <Inventory route={route} />;
      break;
    case 'movements':
      content = <Movements />;
      break;
    case 'count':
      content = <StockCount />;
      break;
    case 'reports':
      content = <Reports />;
      break;
    case 'settings':
      content = <Settings />;
      break;
    default:
      content = <Dashboard />;
  }

  return (
    <div className="app">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand-logo">
          <span className="logo-mark">B</span>
          <div>
            <div className="fw-bold lh-1">Brand Stock</div>
            <div className="small text-secondary">{data.settings.shopName}</div>
          </div>
        </div>
        <nav className="nav flex-column gap-1">
          {NAV.map((n) => (
            <a key={n.key} href={n.href} className={`side-link${page === n.key ? ' active' : ''}`}>
              <i className={`bi ${n.icon}`} />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
      </aside>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="btn btn-light" onClick={() => setMenuOpen(true)} aria-label="القائمة">
            <i className="bi bi-list fs-5" />
          </button>
          <span className="fw-bold">Brand Stock Tracker</span>
        </header>
        <main className="content">
          {saveFailed && (
            <div className="alert alert-danger">
              تعذّر حفظ البيانات في المتصفح (قد تكون المساحة ممتلئة أو التخزين معطّل). حمّل نسخة احتياطية من الإعدادات الآن.
            </div>
          )}
          {content}
        </main>
      </div>
    </div>
  );
}
