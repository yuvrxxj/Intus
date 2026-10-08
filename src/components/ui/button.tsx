import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'ink';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-[#8c121c] border border-primary hover:border-[#8c121c]',
  secondary: 'bg-surface-2 text-ink border border-line-strong hover:border-ink',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:text-ink hover:bg-ink/5',
  ink: 'bg-ink text-paper border border-ink hover:bg-ink/90',
};

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] rounded-md gap-1.5',
  md: 'h-11 px-4 text-sm rounded-[10px] gap-2',
  lg: 'h-12 px-5 text-[15px] rounded-xl gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** The look of a button, for the places where a link has to wear it. */
export function buttonClass({ variant = 'secondary', size = 'md', className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    'inline-flex select-none items-center justify-center font-medium whitespace-nowrap [text-shadow:none] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass({ variant, size, className })} {...rest} />;
});
