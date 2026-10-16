import { computed, ref, watch, type Ref } from 'vue'

import {
  ACP_AGENTS,
  AI_PROVIDERS,
  type AIProviderID,
  type ModelOption
} from '@open-pencil/core/constants'

import type { AIModelProfileDraft, AIModelCapability } from '@/app/ai/models'
import { catalogModel as findCatalogModel, catalogModels } from '@/app/ai/models/catalog'
import { modelPickerOptions, type ModelPickerLabels } from '@/app/ai/models/picker/options'
import { supportsThinkingLevel } from '@/app/ai/models/thinking'

export function useProfileModelSelection(
  draft: AIModelProfileDraft,
  ai: Readonly<Ref<ModelPickerLabels & { customModel: string }>>
) {
  const CUSTOM_MODEL_VALUE = '__custom__'
  const DEFAULT_MAX_OUTPUT_TOKENS = 16384
  const customModelSelected = ref(
    Boolean(draft.customModelID.trim()) || draft.providerID === 'harness:pi'
  )
  const catalogModel = ref<ModelOption | null>(null)

  const providerDef = computed(
    () => AI_PROVIDERS.find((provider) => provider.id === draft.providerID) ?? AI_PROVIDERS[0]
  )
  const availableModels = computed(() => catalogModels(draft.providerID))
  const isACP = computed(() => draft.providerID.startsWith('acp:'))
  const isHarness = computed(() => draft.providerID === 'harness:pi')
  const supportsThinking = computed(() => supportsThinkingLevel(draft.providerID))
  const providerDisplayName = computed(() => {
    if (!isACP.value) return providerDef.value.name

    const agentID = draft.providerID.slice('acp:'.length)
    return ACP_AGENTS.find((agent) => agent.id === agentID)?.name ?? draft.providerID
  })
  const modelOptions = computed(() => {
    const options = modelPickerOptions(availableModels.value, availableModels.value, ai.value)
    if (!providerDef.value.supportsCustomModel) return options
    // Keep the custom entry after the curated picks and ahead of the long tail, so it stays
    // reachable in the picker's capped result list.
    const customOption = {
      value: CUSTOM_MODEL_VALUE,
      label: ai.value.customModel,
      description: '',
      meta: undefined,
      group: ai.value.customModelGroup
    }
    const group = ai.value.recommendedModels
    const insertAt = options.findIndex((option) => option.group !== group)
    if (insertAt === -1) return [...options, customOption]
    return [...options.slice(0, insertAt), customOption, ...options.slice(insertAt)]
  })
  const selectedModelValue = computed(() =>
    customModelSelected.value ? CUSTOM_MODEL_VALUE : draft.modelID
  )
  const knownModel = computed(() => {
    if (isACP.value) return null
    if (draft.customModelID.trim()) return catalogModel.value
    return (
      catalogModel.value ??
      availableModels.value.find((model) => model.id === draft.modelID) ??
      null
    )
  })
  const knownCapabilities = computed<AIModelCapability[]>(() => [
    ...(knownModel.value?.capabilities ?? ['tools'])
  ])
  const outputTokenRecommendation = computed(
    () => knownModel.value?.recommendedMaxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
  )
  const modelDisplayName = computed(() => {
    const modelId = draft.customModelID.trim() || draft.modelID
    return availableModels.value.find((model) => model.id === modelId)?.name || modelId
  })
  const toolsEnabled = capabilityModel('tools')
  const visionEnabled = capabilityModel('vision')

  function capabilityModel(capability: AIModelCapability) {
    return computed({
      get: () => draft.capabilities.includes(capability),
      set: (enabled: boolean) => {
        if (enabled && !draft.capabilities.includes(capability)) draft.capabilities.push(capability)
        if (!enabled) {
          draft.capabilities = draft.capabilities.filter((value) => value !== capability)
        }
      }
    })
  }

  function effectiveModelID(): string {
    return customModelSelected.value ? draft.customModelID.trim() : draft.modelID.trim()
  }

  function refreshCatalogModel(): void {
    catalogModel.value = isACP.value ? null : findCatalogModel(draft.providerID, effectiveModelID())
  }

  function applyKnownModelMetadata(): void {
    if (!knownModel.value) return

    draft.capabilities = [...knownCapabilities.value]
    draft.maxOutputTokens = outputTokenRecommendation.value
  }

  function updateProvider(providerID: AIProviderID): void {
    catalogModel.value = null
    draft.providerID = providerID
    draft.sourceConnectionId = null
    const provider = AI_PROVIDERS.find((definition) => definition.id === providerID)
    draft.modelID = provider?.defaultModel ?? ''
    catalogModel.value = findCatalogModel(providerID, draft.modelID)
    draft.customModelID = ''
    customModelSelected.value = providerID === 'harness:pi'
    if (providerID.startsWith('acp:')) {
      draft.capabilities = ['tools']
      if (!draft.name.trim()) draft.name = providerDisplayName.value
    } else {
      applyKnownModelMetadata()
    }
  }

  function updateModel(modelID: string): void {
    if (modelID === CUSTOM_MODEL_VALUE) {
      customModelSelected.value = true
      draft.customModelID = ''
      catalogModel.value = null

      return
    }
    draft.modelID = modelID
    catalogModel.value = availableModels.value.find((model) => model.id === modelID) ?? null
    customModelSelected.value = false
    draft.customModelID = ''
    applyKnownModelMetadata()
    if (!draft.name.trim()) draft.name = modelDisplayName.value
  }

  watch(
    () => draft.customModelID,
    () => {
      if (!customModelSelected.value) return
      refreshCatalogModel()
      applyKnownModelMetadata()
    }
  )

  refreshCatalogModel()
  // A profile that names no model yet, such as the fresh-install placeholder, starts on the
  // provider's recommended model; reselecting the provider it already has changes nothing.
  const defaultModel = providerDef.value.defaultModel
  if (!isACP.value && !isHarness.value && defaultModel && !effectiveModelID()) {
    updateModel(defaultModel)
  }

  return {
    providerDef,
    isACP,
    isHarness,
    customModelSelected,
    supportsThinking,
    providerDisplayName,
    modelOptions,
    selectedModelValue,
    knownModel,
    knownCapabilities,
    outputTokenRecommendation,
    modelDisplayName,
    toolsEnabled,
    visionEnabled,
    applyKnownModelMetadata,
    updateProvider,
    updateModel
  }
}
