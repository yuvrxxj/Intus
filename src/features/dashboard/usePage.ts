import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PAGE, NAV_PAGES, pageFromHash, type PageId } from './pages.ts';

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The page in view, kept in the address bar's #hash so the back button, a bookmark and a shared link all work. An old
 * #section address opens the page that now holds it. Number keys 1 to 6 open the pages in the top bar, unless the person
 * is typing. Changing page scrolls back to the top.
 */
export function usePage(): [PageId, (id: PageId) => void] {
  const [page, setPage] = useState<PageId>(() => pageFromHash(window.location.hash) ?? DEFAULT_PAGE);

  useEffect(() => {
    // an old address is rewritten to the new one without adding a history entry
    const found = pageFromHash(window.location.hash);
    if (found && window.location.hash !== `#${found}`) window.history.replaceState(null, '', `#${found}`);
    const onHash = () => setPage(pageFromHash(window.location.hash) ?? DEFAULT_PAGE);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // each page opens at its top, whichever way it was reached
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'instant' as ScrollBehavior });
  }, [page]);

  const go = useCallback((id: PageId) => {
    if (window.location.hash === `#${id}`) {
      setPage(id);
      return;
    }
    window.location.hash = id;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < NAV_PAGES.length) go(NAV_PAGES[index].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return [page, go];
}
