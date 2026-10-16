import type { LanguageModel } from 'ai'
import { ref } from 'vue'

import { createLanguageModel } from '@/app/ai/chat/model'
import { modelConnection, resolveAIModelRole } from '@/app/ai/models/store'
import type { AIModelConnection, AIModelRole, ResolvedAIModelRole } from '@/app/ai/models/types'
import { appCredentialServices } from '@/app/settings/credentials/app'
import {
  initializeCredentialMigration,
  providerCredentialRef
} from '@/app/settings/credentials/migration'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

export type DirectAIModelRuntime = {
  kind: 'direct'
  role: ResolvedAIModelRole
  model: LanguageModel
}

export type AIModelRuntime = DirectAIModelRuntime

export function modelConnectionCredentialRef(connection: AIModelConnection): CredentialRef {
  return providerCredentialRef(connection.providerID, connection.credentialProfileId)
}

export async function modelConnectionCredentialStatus(
  connectionId: string
): Promise<CredentialStatus> {
  const connection = modelConnection(connectionId)
  if (!connection) return 'missing'
  return appCredentialServices.manager.status(modelConnectionCredentialRef(connection))
}

/** Changes whenever a model connection's key is saved or cleared, so status views can refresh. */
export const modelCredentialRevision = ref(0)

export async function setModelConnectionAPIKey(connectionId: string, value: string): Promise<void> {
  const connection = modelConnection(connectionId)
  if (!connection) return
  const reference = modelConnectionCredentialRef(connection)
  const key = value.trim()
  try {
    if (key) await appCredentialServices.manager.set(reference, key)
    else await appCredentialServices.manager.clear(reference)
  } finally {
    modelCredentialRevision.value++
  }
}

export async function resolveModelConnectionAPIKey(connectionId: string): Promise<string | null> {
  await initializeCredentialMigration()
  const connection = modelConnection(connectionId)
  if (!connection) return null
  return appCredentialServices.resolver.resolve(modelConnectionCredentialRef(connection))
}

export async function createAIModelRuntime(role: AIModelRole): Promise<AIModelRuntime | null> {
  const resolved = resolveAIModelRole(role)
  if (!resolved) return null
  if (role === 'design' && !resolved.profile.capabilities.includes('tools')) {
    throw new Error('The Design model must support tools')
  }
  if (role === 'vision' && !resolved.profile.capabilities.includes('vision')) {
    throw new Error('The Vision model must support image input')
  }
  const apiKey = await resolveModelConnectionAPIKey(resolved.connection.id)
  if (!apiKey) throw new Error(`Credential is unavailable for the ${role} model role`)
  return {
    kind: 'direct',
    role: resolved,
    model: createLanguageModel({
      providerID: resolved.connection.providerID,
      apiKey,
      modelID: resolved.profile.modelID,
      customModelID: resolved.profile.customModelID
    })
  }
}
