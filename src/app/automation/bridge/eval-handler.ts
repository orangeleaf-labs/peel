import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { compileScript } from '@open-pencil/core/tools'

import { receiveAutomationCall } from '@/app/automation/bridge/call'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { automationUndoLabel, executeWithDocumentUndo } from '@/app/automation/execution/editor'
import { approveWrite, codeWriteRequest } from '@/app/automation/write-approval'
import { ensureGraphFonts } from '@/app/editor/fonts'

type FigmaFactory = (store: AutomationTarget['store'], pageId?: string) => FigmaAPI

export function createAutomationEvalHandler(makeFigma: FigmaFactory) {
  return async function handleEval(
    target: AutomationTarget,
    args: unknown,
    call = receiveAutomationCall(args)
  ): Promise<unknown> {
    const code = (args as { code?: string }).code
    if (!code) throw new Error('Missing "code" in args')
    // A script runs with the app's permissions, so the user allows each one, whatever it does.
    await approveWrite(codeWriteRequest('eval', code), call.approval)
    const figma = makeFigma(target.store, target.pageId)
    const run = compileScript(code)
    const result = await executeWithDocumentUndo(
      target.store,
      target.pageId,
      automationUndoLabel('eval'),
      () =>
        target.store.runMutationWithLayout(
          () => run(figma),
          target.pageId,
          async () => {
            const page = target.store.graph.getNode(target.pageId)
            if (page)
              await ensureGraphFonts(target.store.graph, page.childIds, target.store.renderer)
          }
        )
    )
    target.store.requestRender()
    return { ok: true, result: result ?? null }
  }
}
