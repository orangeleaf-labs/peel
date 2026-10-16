import { tv } from 'tailwind-variants'

/** Which agents work on a page: a sparkle per agent, then "+N". */
export const pageMarkers = tv({
  slots: {
    root: 'flex shrink-0 items-center gap-1',
    agent: 'size-3',
    overflow: 'text-[9px] leading-none text-muted'
  }
})
