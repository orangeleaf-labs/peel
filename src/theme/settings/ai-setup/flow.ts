import { motionStyles } from '@/theme/motion/styles'

export default {
  slots: {
    body: 'flex flex-col gap-3 text-xs text-surface',
    help: 'text-xs leading-relaxed text-muted',
    intro: 'rounded-lg border border-accent/25 bg-accent/5 p-4',
    introHeading: 'text-sm font-semibold text-surface',
    introText: 'mt-2 text-xs leading-relaxed text-muted',
    tour: 'flex items-start justify-between gap-4 rounded-lg border border-border p-4',
    tourAction: 'shrink-0',
    group: 'flex flex-col gap-2',
    groupHeading: 'text-[11px] font-semibold text-muted',
    // Reads as a group heading; the gap below lives inside the animated content.
    connection: 'flex flex-col gap-3 rounded-md border border-border p-3',
    connectionHeading: 'flex items-center gap-2 text-xs font-semibold text-surface',
    spinner: `size-3.5 shrink-0 ${motionStyles.spinner}`
  }
}
