import { tv } from 'tailwind-variants'

import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

/** Your avatar beside the properties panel and the menu of your agents it opens. */
export const selfPresence = tv({
  slots: {
    trigger:
      'relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-panel-focus',
    card: ['z-50 w-60 p-2', floatingSurface, motionStyles.floating]
  }
})
