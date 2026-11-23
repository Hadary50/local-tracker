import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Variant = 'success' | 'danger' | 'warning' | 'info';
type Push = (message: string, variant?: Variant) => void;

const Ctx = createContext<Push>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; v: Variant }[]>([]);

  const push = useCallback<Push>((msg, v = 'success') => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, msg, v }]);
    setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-container position-fixed bottom-0 start-0 p-3" style={{ zIndex: 2000 }}>
        {items.map((t) => (
          <div key={t.id} className={`toast show align-items-center text-bg-${t.v} border-0 mb-2`} role="status">
            <div className="toast-body">{t.msg}</div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
