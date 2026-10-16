import { appPreferences, type CanvasRenderingMode } from '@/app/settings/preferences/store'
import { IS_BROWSER } from '@/constants'

export type SceneRendererMode = CanvasRenderingMode

export interface AppRuntimeConfig {
  test: boolean
  navigationBenchmark: boolean
  recentFiles: boolean
  showChrome: boolean
  showRulers: boolean
  sceneRenderer: SceneRendererMode
  sceneRendererOverride: boolean
}

export function parseAppRuntimeConfig(
  search: string,
  preferredRenderer: SceneRendererMode = 'retained'
): AppRuntimeConfig {
  const params = new URLSearchParams(search)
  const renderer = params.get('renderer')
  const sceneRenderer =
    renderer === 'tiled' || renderer === 'retained' ? renderer : preferredRenderer
  return {
    test: params.has('test'),
    navigationBenchmark: params.has('navigation-benchmark'),
    recentFiles: params.has('recent-files'),
    showChrome: !params.has('no-chrome'),
    showRulers: !params.has('no-rulers'),
    sceneRenderer,
    sceneRendererOverride: renderer === 'tiled' || renderer === 'retained'
  }
}

export const appRuntimeConfig = parseAppRuntimeConfig(
  IS_BROWSER ? window.location.search : '',
  appPreferences.value.rendering.canvasMode
)
