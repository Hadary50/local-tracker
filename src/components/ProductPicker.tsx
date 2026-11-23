import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { matchesQuery, sortProducts } from '../lib/logic';
import type { Product } from '../types';

interface Props {
  value: string;
  onChange: (productId: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

/** Type to search by brand / product / size / color / SKU, then pick from the list. */
export default function ProductPicker({ value, onChange, disabled, autoFocus, placeholder }: Props) {
  const { data } = useStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const brandName = (p: Product) => data.brands.find((b) => b.id === p.brandId)?.name ?? '';
  const label = (p: Product) =>
    [brandName(p), p.name, p.size, p.color].filter(Boolean).join(' · ');

  const selected = data.products.find((p) => p.id === value);

  const results = useMemo(() => {
    const list = data.products.filter((p) =>
      matchesQuery(`${brandName(p)} ${p.name} ${p.size} ${p.color} ${p.sku}`, query),
    );
    return sortProducts(data, list).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query]);

  return (
    <div className="position-relative">
      <input
        className="form-control"
        value={open ? query : selected ? label(selected) : ''}
        placeholder={placeholder ?? 'ابحث عن منتج بالاسم أو العلامة أو المقاس أو اللون...'}
        disabled={disabled}
        autoFocus={autoFocus}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="list-group picker-list shadow-sm" onMouseDown={(e) => e.preventDefault()}>
          {results.length === 0 && <div className="list-group-item text-secondary small">لا توجد نتائج</div>}
          {results.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2${
                p.id === value ? ' active' : ''
              }`}
              onClick={() => {
                onChange(p.id);
                setOpen(false);
                (document.activeElement as HTMLElement | null)?.blur();
              }}
            >
              <span>{label(p)}</span>
              <span className="small opacity-75">الرصيد: {p.qty}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
