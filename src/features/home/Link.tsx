import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from './useRoute.ts';

/** An ordinary link that changes page without a reload. Modified clicks (new tab, new window) keep their default. */
export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  }
  return <a href={to} onClick={click} {...rest} />;
}
