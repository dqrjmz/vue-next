import { App } from './apiCreateApp'
import { Fragment, Text, Comment, Static } from './vnode'
import { ComponentInternalInstance } from './component'

export interface AppRecord {
  id: number
  app: App
  version: string
  types: Record<string, string | Symbol>
}

enum DevtoolsHooks {
  APP_INIT = 'app:init',
  APP_UNMOUNT = 'app:unmount',
  COMPONENT_UPDATED = 'component:updated',
  COMPONENT_ADDED = 'component:added',
  COMPONENT_REMOVED = 'component:removed'
}

export interface DevtoolsHook {
  emit: (event: string, ...payload: any[]) => void
  on: (event: string, handler: Function) => void
  once: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
  appRecords: AppRecord[]
}

export let devtools: DevtoolsHook

export function setDevtoolsHook(hook: DevtoolsHook) {
  devtools = hook
}

/**
 * 初始化app
 * @param app 应用程序实例
 * @param version 版本
 */
export function initApp(app: App, version: string) {
  // TODO queue if devtools is undefined
  // 没有开发工具，直接返回
  if (!devtools) return
  // 调用开发工具app初始化
  devtools.emit(DevtoolsHooks.APP_INIT, app, version, {
    Fragment: Fragment,
    Text: Text,
    Comment: Comment,
    Static: Static
  })
}

/**
 * app被卸载
 * @param app 
 */
export function appUnmounted(app: App) {
  // 没有开启vue开发者工具,不需要处理
  if (!devtools) return
  // 调用开发者工具钩子函数，卸载
  devtools.emit(DevtoolsHooks.APP_UNMOUNT, app)
}

export const componentAdded = createDevtoolsHook(DevtoolsHooks.COMPONENT_ADDED)

export const componentUpdated = createDevtoolsHook(
  DevtoolsHooks.COMPONENT_UPDATED
)

export const componentRemoved = createDevtoolsHook(
  DevtoolsHooks.COMPONENT_REMOVED
)

function createDevtoolsHook(hook: DevtoolsHooks) {
  return (component: ComponentInternalInstance) => {
    if (!devtools || !component.appContext.__app) return
    devtools.emit(
      hook,
      component.appContext.__app,
      component.uid,
      component.parent ? component.parent.uid : undefined
    )
  }
}
