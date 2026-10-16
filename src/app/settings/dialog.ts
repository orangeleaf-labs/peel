import { ref } from 'vue'

/** The Settings dialog's sections, in the order its navigation lists them. */
export const SETTINGS_SECTIONS = [
  'general',
  'toolbar',
  'ai',
  'usage',
  'diagnostics',
  'mcp',
  'tools',
  'storage'
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export const settingsDialogOpen = ref(false)
export const settingsDialogSection = ref<SettingsSection>('general')

type SettingsNavigationRequest = (action: () => void) => void
let requestNavigation: SettingsNavigationRequest | null = null

export function registerSettingsNavigation(request: SettingsNavigationRequest) {
  requestNavigation = request
  return () => {
    if (requestNavigation === request) requestNavigation = null
  }
}

export function openSettingsDialog(section?: SettingsSection): void {
  if (settingsDialogOpen.value && (!section || section === settingsDialogSection.value)) return
  const open = () => {
    if (section) settingsDialogSection.value = section
    settingsDialogOpen.value = true
  }
  if (settingsDialogOpen.value && requestNavigation) requestNavigation(open)
  else open()
}
