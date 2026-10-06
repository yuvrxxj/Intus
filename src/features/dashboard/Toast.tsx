import { AnimatePresence, motion } from 'framer-motion';
import { Check, TriangleAlert } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type Notify = (message: string, error?: boolean) => void;

interface ToastState { id: number; message: string; error: boolean }

export function useToast(): { toast: ToastState | null; notify: Notify } {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const notify = useCallback<Notify>((message, error = false) => {
    setToast({ id: Date.now(), message, error });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), error ? 4000 : 2400);
  }, []);
  return { toast, notify };
}

/** A quiet confirmation pill at the bottom of the screen. Errors stay a little longer. */
export function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-50 flex justify-center px-4 lg:bottom-8 lg:pl-[var(--rail-w)]" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium shadow-[0_8px_24px_rgb(31_19_0/0.18)]',
              toast.error ? 'bg-primary text-paper' : 'bg-ink text-paper',
            )}
          >
            {toast.error ? <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> : <Check className="size-4 shrink-0" aria-hidden="true" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
