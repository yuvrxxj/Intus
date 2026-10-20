import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';
import { buttonClass } from '@/components/ui/button';

export type CalendarProps = ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  ...props
}: CalendarProps) {
  const defaultClassNames = {
    months: 'relative flex flex-col sm:flex-row gap-4',
    month: 'w-full',
    month_caption: 'relative mx-10 mb-1 flex h-9 items-center justify-center z-20',
    caption_label: 'inline-flex items-center gap-1 text-sm font-medium',
    dropdowns: 'flex items-center justify-center gap-1',
    dropdown_root: 'relative inline-flex items-center rounded-md px-1.5 py-1 hover:bg-accent has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring/70',
    dropdown: 'absolute inset-0 size-full cursor-pointer appearance-none opacity-0',
    nav: 'absolute top-0 flex w-full justify-between z-10',
    button_previous: cn(buttonClass({ variant: 'ghost' }), 'size-9 text-muted-foreground/80 hover:text-foreground p-0'),
    button_next: cn(buttonClass({ variant: 'ghost' }), 'size-9 text-muted-foreground/80 hover:text-foreground p-0'),
    weekday: 'size-9 p-0 text-xs font-medium text-muted-foreground/80',
    day_button:
      'relative flex size-9 items-center justify-center whitespace-nowrap rounded-lg p-0 text-foreground outline-offset-2 group-[[data-selected]:not(.range-middle)]:[transition-property:color,background-color,border-radius,box-shadow] group-[[data-selected]:not(.range-middle)]:duration-150 focus:outline-none group-data-[disabled]:pointer-events-none focus-visible:z-10 hover:bg-accent group-data-[selected]:bg-primary hover:text-foreground group-data-[selected]:text-primary-foreground group-data-[disabled]:text-foreground/30 group-data-[disabled]:line-through group-data-[outside]:text-foreground/30 group-data-[outside]:group-data-[selected]:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 group-[.range-start:not(.range-end)]:rounded-e-none group-[.range-end:not(.range-start)]:rounded-s-none group-[.range-middle]:rounded-none group-data-[selected]:group-[.range-middle]:bg-accent group-data-[selected]:group-[.range-middle]:text-foreground',
    day: 'group size-9 px-0 text-sm',
    range_start: 'range-start',
    range_end: 'range-end',
    range_middle: 'range-middle',
    today:
      '*:after:pointer-events-none *:after:absolute *:after:bottom-1 *:after:start-1/2 *:after:z-10 *:after:size-[3px] *:after:-translate-x-1/2 *:after:rounded-full *:after:bg-primary [&[data-selected]:not(.range-middle)>*]:after:bg-background [&[data-disabled]>*]:after:bg-foreground/30 *:after:transition-colors',
    outside: 'text-muted-foreground data-selected:bg-accent/50 data-selected:text-muted-foreground',
    hidden: 'invisible',
    week_number: 'size-9 p-0 text-xs font-medium text-muted-foreground/80',
  };

  const mergedClassNames: typeof defaultClassNames = Object.keys(defaultClassNames).reduce(
    (acc, key) => ({
      ...acc,
      [key]: classNames?.[key as keyof typeof classNames]
        ? cn(defaultClassNames[key as keyof typeof defaultClassNames], classNames[key as keyof typeof classNames])
        : defaultClassNames[key as keyof typeof defaultClassNames],
    }),
    {} as typeof defaultClassNames,
  );

  const defaultComponents = {
    Chevron: ({ orientation, ...rest }: { orientation?: string; className?: string }) =>
      orientation === 'down'
        ? <ChevronDown size={14} strokeWidth={2} className={rest.className} aria-hidden="true" />
        : orientation === 'left'
        ? <ChevronLeft size={16} strokeWidth={2} className={rest.className} aria-hidden="true" />
        : <ChevronRight size={16} strokeWidth={2} className={rest.className} aria-hidden="true" />,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('w-fit', className)}
      classNames={mergedClassNames}
      components={{ ...defaultComponents, ...userComponents }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
