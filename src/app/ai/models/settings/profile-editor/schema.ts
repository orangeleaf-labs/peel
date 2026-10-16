import * as v from 'valibot'

import { requiredSetting, type SettingsValidationMessages } from '@/app/settings/validation/schema'

export interface ModelProfileValidationContext {
  customModel: boolean
  design: boolean
  intent: 'save' | 'test'
}

export interface ModelProfileValidationMessages extends SettingsValidationMessages {
  designToolsRequired: string
}

export function modelProfileSchema(
  context: ModelProfileValidationContext,
  messages: ModelProfileValidationMessages
) {
  const modelField = context.customModel ? 'customModelID' : 'modelID'
  return v.pipe(
    v.object({
      name: context.intent === 'save' ? requiredSetting(messages.requiredField) : v.string(),
      modelID: !context.customModel ? requiredSetting(messages.requiredField) : v.string(),
      customModelID: context.customModel ? requiredSetting(messages.requiredField) : v.string(),
      credential:
        context.intent === 'test'
          ? v.pipe(
              v.boolean(),
              v.check((value: boolean) => value, messages.requiredField)
            )
          : v.boolean(),
      tools: v.boolean()
    }),
    v.forward(
      v.partialCheck(
        [['tools']],
        ({ tools }) => context.intent !== 'save' || !context.design || tools,
        messages.designToolsRequired
      ),
      [modelField]
    )
  )
}
