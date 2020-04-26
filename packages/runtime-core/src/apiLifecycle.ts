import {
  ComponentInternalInstance,
  LifecycleHooks,
  currentInstance,
  setCurrentInstance,
  isInSSRComponentSetup
} from './component'
import { ComponentPublicInstance } from './componentProxy'
import { callWithAsyncErrorHandling, ErrorTypeStrings } from './errorHandling'
import { warn } from './warning'
import { capitalize } from '@vue/shared'
import { pauseTracking, resetTracking, DebuggerEvent } from '@vue/reactivity'

// KeepAlive组件中的生命周期，活跃，不活跃
export { onActivated, onDeactivated } from './components/KeepAlive'

/**
 * 注入钩子
 * @param type 生命周期钩子类型，枚举
 * @param hook 钩子函数
 * @param target 组件实例
 * @param prepend 从开始位置放入
 */
export function injectHook(
  type: LifecycleHooks,
  hook: Function & { __weh?: Function },
  target: ComponentInternalInstance | null = currentInstance,
  prepend: boolean = false
) {
  // 没有组件实例
  if (target) {
    // 获取组件的钩子函数
    const hooks = target[type] || (target[type] = [])
    // cache the error handling wrapper for injected hooks so the same hook
    // can be properly deduped by the scheduler. "__weh" stands for "with error
    // handling".
    // 包裹函数，不存在，就创建函数
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = (...args: unknown[]) => {
        // 组件被卸载，直接返回
        if (target.isUnmounted) {
          return
        }
        // disable tracking inside all lifecycle hooks
        // since they can potentially be called inside effects.
        // 暂停追踪响应式系统
        pauseTracking()
        // Set currentInstance during hook invocation.
        // This assumes the hook does not synchronously trigger other hooks, which
        // can only be false when the user does something really funky.
        // 设置当前组件
        setCurrentInstance(target)
        // 调用
        const res = callWithAsyncErrorHandling(hook, target, type, args)
        // 设置当前组件为null
        setCurrentInstance(null)
        // 重置追踪响应式系统
        resetTracking()
        return res
      })
    if (prepend) {
      hooks.unshift(wrappedHook)
    } else {
      hooks.push(wrappedHook)
    }
  } else if (__DEV__) { //开发中
    // 整理钩子函数名称
    const apiName = `on${capitalize(
      // 将后缀hook替换为''
      ErrorTypeStrings[type].replace(/ hook$/, '')
    )}`
    warn(
      `${apiName} is called when there is no active component instance to be ` +
        `associated with. ` +
        `Lifecycle injection APIs can only be used during execution of setup().` +
        (__FEATURE_SUSPENSE__
          ? ` If you are using async setup(), make sure to register lifecycle ` +
            `hooks before the first await statement.`
          : ``)
    )
  }
}

/**
 * 创建钩子函数
 * @param lifecycle 钩子函数，不是在服务端渲染组件的setup中
 */
export const createHook = <T extends Function = () => any>(
  lifecycle: LifecycleHooks
) => (hook: T, target: ComponentInternalInstance | null = currentInstance) =>
  // post-create lifecycle registrations are noops during SSR
  !isInSSRComponentSetup && injectHook(lifecycle, hook, target)

// 创建组件安装之前钩子
export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
// 创建组件安装之后
export const onMounted = createHook(LifecycleHooks.MOUNTED)
// 组件更新之前
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
// 组件更新之后
export const onUpdated = createHook(LifecycleHooks.UPDATED)
// 组件卸载之前
export const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
// 组件卸载之后
export const onUnmounted = createHook(LifecycleHooks.UNMOUNTED)

export type DebuggerHook = (e: DebuggerEvent) => void
// 渲染被触发
export const onRenderTriggered = createHook<DebuggerHook>(
  LifecycleHooks.RENDER_TRIGGERED
)
// 渲染被追踪
export const onRenderTracked = createHook<DebuggerHook>(
  LifecycleHooks.RENDER_TRACKED
)

export type ErrorCapturedHook = (
  err: unknown,
  instance: ComponentPublicInstance | null,
  info: string
) => boolean | void

// 错误捕获
export const onErrorCaptured = (
  hook: ErrorCapturedHook,
  target: ComponentInternalInstance | null = currentInstance
) => {
  injectHook(LifecycleHooks.ERROR_CAPTURED, hook, target)
}
