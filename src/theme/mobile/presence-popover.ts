import { tv } from 'tailwind-variants'

import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

/** The mobile HUD's pill of your agents and the list it opens. */
export const presencePopover = tv({
  slots: {
    trigger: 'pl-1.5 pr-1.5',
    content: ['z-50 w-60 p-3', floatingSurface, motionStyles.floating]
  }
})
