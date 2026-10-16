<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue'

import {
  answerWriteApproval,
  currentWriteApproval,
  type WriteRequest
} from '@/app/automation/write-approval'
import { AppConfirmationDialog } from '@/components/ui/dialog'

/** Asks before an agent writes outside the document: a file, an export, or app settings. */
const messages = useAutomationMessages()

// The dialog closes itself before it confirms, so it keeps which request it was asked about.
const open = ref(false)
const shown = shallowRef<WriteRequest | null>(null)

watch(
  currentWriteApproval,
  (request) => {
    shown.value = request
    open.value = request !== null
  },
  { immediate: true }
)

// Escape, or a close without an answer, denies. The dialog closes before its buttons answer,
// so this waits a tick and leaves a request the click already answered alone.
function onOpenChange(value: boolean) {
  const request = shown.value
  if (value || !request) return
  void nextTick(() => {
    if (shown.value === request) answer(false)
  })
}

function answer(allowed: boolean) {
  const request = shown.value
  if (!request) return
  shown.value = null
  answerWriteApproval(request, allowed)
}

function mainDescription(request: WriteRequest): string {
  const m = messages.value
  const { tool, target } = request
  if (!target) return m.writeApprovalUnknownTarget({ tool })
  switch (request.kind) {
    case 'save':
      return m.writeApprovalSave({ tool, target })
    case 'export':
      return m.writeApprovalExport({ tool, target, format: request.format ?? '' })
    case 'settings':
      return m.writeApprovalSettings({ tool, target })
    case 'write':
      return m.writeApprovalWrite({ tool, target })
    case 'code':
      return m.writeApprovalCode({ tool, target })
  }
}

const description = computed(() =>
  shown.value ? `${mainDescription(shown.value)} ${messages.value.writeApprovalDenyHint}` : ''
)
</script>

<template>
  <AppConfirmationDialog
    v-model:open="open"
    :heading="messages.writeApprovalTitle"
    :description="description"
    :cancel-label="messages.writeApprovalDeny"
    :confirm-label="messages.writeApprovalAllow"
    tone="warning"
    @confirm="answer(true)"
    @cancel="answer(false)"
    @update:open="onOpenChange"
  />
</template>
