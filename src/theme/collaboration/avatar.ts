import { tv } from 'tailwind-variants'

/** A person's initials on their color, in the avatar stack, presence lists, and comments. */
export const avatar = tv({
  base: 'flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
  variants: {
    size: { sm: 'size-6', md: 'size-7' },
    bordered: { true: 'border-2 border-panel', false: '' },
    following: { true: 'ring-2 ring-white/40', false: '' },
    interactive: { true: 'cursor-pointer transition-all', false: '' }
  },
  compoundVariants: [{ following: true, bordered: true, class: 'border-white' }],
  defaultVariants: {
    size: 'sm',
    bordered: false,
    following: false,
    interactive: false
  }
})
