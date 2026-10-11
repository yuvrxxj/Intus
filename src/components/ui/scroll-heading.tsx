import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * A section title that lights red while it is in the upper part of the window and rests in quiet ink below it, with
 * the edge of the light cutting across the letters as the page scrolls. It needs no script: the colour is a gradient
 * pinned to the viewport and clipped to the text. The styles are `.scroll-heading` in `src/styles/components.css`,
 * where the band's edges (`--band-top`, `--band-bottom`, in vh) can be changed per heading with a style prop or a class.
 *
 * The effect needs the title to have no transformed ancestor (a transform turns the pinned gradient into a scrolling
 * one), and it switches itself off for reduced motion, print, forced colours and touch screens, where the title is
 * plain ink.
 */
export function ScrollHeading({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 {...props} className={cn('scroll-heading', className)} />;
}
