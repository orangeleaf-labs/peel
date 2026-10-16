import { ref } from 'vue'

import { initializeCredentialMigration } from './migration'
import { setAppCredentialPersistence } from './persistence'

export const credentialPersistenceRevision = ref(0)

export async function setRememberCredentials(remembered: boolean): Promise<void> {
  await initializeCredentialMigration()
  await setAppCredentialPersistence(remembered)
  credentialPersistenceRevision.value++
}
