import {
  answerWriteApproval,
  currentWriteApproval,
  type WriteRequest
} from '@/app/automation/write-approval'

/** Waits until an agent's write asks the user, as the dialog would show it. */
export async function nextWriteApproval(): Promise<WriteRequest> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const request = currentWriteApproval.value
    if (request) return request
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
  throw new Error('No write approval was requested')
}

/** Answers the next write approval the way the user would in the dialog. */
export async function answerNextWriteApproval(allowed: boolean): Promise<WriteRequest> {
  const request = await nextWriteApproval()
  answerWriteApproval(request, allowed)
  return request
}
