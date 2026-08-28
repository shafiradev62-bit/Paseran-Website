import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, Info, X, AlertTriangle } from "lucide-react";

type Kind = "info" | "success" | "warn";
type Toast = { id: number; title: string; body?: string; kind: Kind };
type CtxValue = {
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
  list: Toast[];
};

const Ctx = createContext<CtxValue>({ push: () => {}, dismiss: () => {}, list: [] });
export const useNotify = () => useContext(Ctx).push;

function Item({ t, onClose }: { t: Toast; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(() => setLeaving(true), 3200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(onClose, 220);
    return () => clearTimeout(id);
  }, [leaving, onClose]);

  const Icon = t.kind === "success" ? Check : t.kind === "warn" ? AlertTriangle : Info;

  return (
    <div className={`toast ${leaving ? "is-leaving" : ""}`} role="status">
      <span className="toast-icon">
        <Icon size={14} strokeWidth={2.4} />
      </span>
      <div className="toast-text">
        <div className="toast-title">{t.title}</div>
        {t.body && <div className="toast-body">{t.body}</div>}
      </div>
      <button
        className="toast-close"
        onClick={() => setLeaving(true)}
        aria-label="Tutup notifikasi"
      >
        <X size={13} strokeWidth={2.4} />
      </button>
      <span className="toast-progress" />
    </div>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((t: Omit<Toast, "id">) => {
    seq.current += 1;
    const item = { ...t, id: seq.current };
    // Replace existing toast of the same kind — never stack duplicates
    setList((l) => [...l.filter((x) => x.kind !== t.kind), item]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setList((l) => l.filter((x) => x.id !== id));
  }, []);

  const value = useMemo(() => ({ push, dismiss, list }), [push, dismiss, list]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function ToastStack() {
  const { list, dismiss } = useContext(Ctx);
  return (
    <div className="toast-stack">
      {list.map((t) => (
        <Item key={t.id} t={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
