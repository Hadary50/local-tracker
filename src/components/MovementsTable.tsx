import { useState } from 'react';
import type { Movement } from '../types';
import { useStore } from '../store';
import { describeMovement, MOVEMENT_SIGN } from '../lib/logic';
import { Empty, TypeBadge, variantLabel } from './ui';

interface Props {
  movements: Movement[];
  pageSize?: number;
  emptyText?: string;
}

export default function MovementsTable({ movements, pageSize, emptyText = 'لا توجد حركات' }: Props) {
  const { data } = useStore();
  const [limit, setLimit] = useState(pageSize ?? Infinity);
  const shown = movements.slice(0, limit);

  if (movements.length === 0) return <Empty text={emptyText} />;

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>العلامة</th>
              <th>المنتج</th>
              <th className="text-center">الكمية</th>
              <th>المستخدم</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const d = describeMovement(data, m);
              const sign = MOVEMENT_SIGN[m.type];
              return (
                <tr key={m.id}>
                  <td className="text-nowrap">{m.date}</td>
                  <td>
                    <TypeBadge type={m.type} />
                  </td>
                  <td>{d.brandName}</td>
                  <td>
                    {d.productName}
                    {variantLabel(d.size, d.color) && (
                      <div className="small text-secondary">{variantLabel(d.size, d.color)}</div>
                    )}
                  </td>
                  <td className={`text-center fw-semibold ${sign > 0 ? 'text-success' : 'text-danger'}`} dir="ltr">
                    {sign > 0 ? '+' : '−'}
                    {m.qty}
                  </td>
                  <td>{m.user}</td>
                  <td className="text-secondary small">{m.notes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length < movements.length && (
        <div className="text-center p-3">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setLimit((l) => l + (pageSize ?? 50))}>
            عرض المزيد ({movements.length - shown.length} متبقية)
          </button>
        </div>
      )}
    </>
  );
}
