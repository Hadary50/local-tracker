import type { ReactNode } from 'react';
import type { MovementType } from '../types';
import { MOVEMENT_LABELS } from '../lib/logic';
import { useStore } from '../store';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
      <div>
        <h1 className="h4 fw-bold mb-0">{title}</h1>
        {subtitle && <div className="text-secondary small mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: ReactNode;
  icon: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
}) {
  return (
    <div className="card stat-card h-100">
      <div className="card-body d-flex align-items-center gap-3">
        <div className={`stat-icon bg-${tone}-subtle text-${tone}-emphasis`}>
          <i className={`bi ${icon}`} />
        </div>
        <div>
          <div className="text-secondary small">{label}</div>
          <div className="fs-4 fw-bold lh-sm">{value}</div>
        </div>
      </div>
    </div>
  );
}

export function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="text-center text-secondary py-5">
      <div className="mb-2">{text}</div>
      {children}
    </div>
  );
}

/** Converts Google Drive, Dropbox, OneDrive, and common cloud image links to direct image URLs */
export function formatImageUrl(url?: string): string {
  if (!url) return '';
  let trimmed = url.trim();

  // If URL was wrapped in excel HYPERLINK function or quotes
  trimmed = trimmed.replace(/^=HYPERLINK\("?([^",]+)"?.*$/i, '$1').replace(/^["']|["']$/g, '');

  // Google Drive preview/file link -> direct thumbnail link
  const gdMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
  if (gdMatch) {
    return `https://drive.google.com/thumbnail?id=${gdMatch[1]}&sz=w400`;
  }

  // Dropbox link -> raw=1
  if (trimmed.includes('dropbox.com')) {
    return trimmed.replace('dl=0', 'raw=1');
  }

  return trimmed;
}

export function ProductImage({
  src,
  size = 40,
  className = '',
}: {
  src?: string;
  size?: number;
  className?: string;
}) {
  const formatted = formatImageUrl(src);
  if (!formatted) {
    return (
      <div
        className={`bg-light rounded border d-flex align-items-center justify-content-center text-muted ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        <i className="bi bi-image" style={{ fontSize: size * 0.4 }} />
      </div>
    );
  }
  return (
    <a href={formatted} target="_blank" rel="noreferrer" title="تكبير الصورة">
      <img
        src={formatted}
        alt=""
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className={`rounded object-fit-cover border shadow-sm ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        onError={(e) => {
          const target = e.currentTarget;
          target.onerror = null;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `<div class="bg-light rounded border d-flex align-items-center justify-content-center text-muted" style="width:${size}px;height:${size}px;"><i class="bi bi-image-alt" style="font-size:${size * 0.4}px;"></i></div>`;
          }
        }}
      />
    </a>
  );
}

const TYPE_TONE: Record<MovementType, string> = {
  received: 'success',
  sold: 'primary',
  missing: 'danger',
  returned: 'warning',
};

export function TypeBadge({ type }: { type: MovementType }) {
  return <span className={`badge text-bg-${TYPE_TONE[type]}`}>{MOVEMENT_LABELS[type]}</span>;
}

/** Quantity pill: red at 0, yellow when at/below the shortage threshold, green otherwise. */
export function QtyBadge({ qty }: { qty: number }) {
  const { data } = useStore();
  const cls =
    qty <= 0
      ? 'bg-danger-subtle text-danger-emphasis'
      : qty <= data.settings.lowStockThreshold
        ? 'bg-warning-subtle text-warning-emphasis'
        : 'bg-success-subtle text-success-emphasis';
  return <span className={`badge rounded-pill qty-badge ${cls}`}>{qty}</span>;
}

export function variantLabel(size: string, color: string) {
  return [size, color].filter(Boolean).join(' · ');
}
