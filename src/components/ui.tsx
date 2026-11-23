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
