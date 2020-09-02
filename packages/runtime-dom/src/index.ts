import {
  createRenderer,
  createHydrationRenderer,
  warn,
  RootRenderFunction,
  CreateAppFunction,
  Renderer,
  HydrationRenderer,
  App,
  RootHydrateFunction
} from '@vue/runtime-core'
import { nodeOps } from './nodeOps'
import { patchProp, forcePatchProp } from './patchProp'
// Importing from the compiler, will be tree-shaken in prod
import { isFunction, isString, isHTMLTag, isSVGTag, extend } from '@vue/shared'

declare module '@vue/reactivity' {
  export interface RefUnwrapBailTypes {
    // Note: if updating this, also update `types/refBail.d.ts`.
    runtimeDOMBailTypes: Node | Window
  }
}

// 渲染器配置选项函数集合，增删改查
const rendererOptions = extend({ patchProp, forcePatchProp }, nodeOps)

// 懒创建渲染器， 这个使得核心渲染器逻辑可以树摇
// lazy create the renderer - this makes core renderer logic tree-shakable
// 在用户只是从Vue导入reactivity工具的案例中
// in case the user only imports reactivity utilities from Vue.
let renderer: Renderer<Element> | HydrationRenderer

let enabledHydration = false

// 获取渲染器
function ensureRenderer() {
  // 缓存渲染器 || 没有则创建
  return renderer || (renderer = createRenderer<Node, Element>(rendererOptions))
}

function ensureHydrationRenderer() {
  renderer = enabledHydration
    ? renderer
    : createHydrationRenderer(rendererOptions)
  enabledHydration = true
  return renderer as HydrationRenderer
}

// use explicit type casts here to avoid import() calls in rolled-up d.ts
export const render = ((...args) => {
  ensureRenderer().render(...args)
}) as RootRenderFunction<Element>

export const hydrate = ((...args) => {
  ensureHydrationRenderer().hydrate(...args)
}) as RootHydrateFunction

// 创建app 参数：配置选项
export const createApp = ((...args) => {
  // 渲染器中返回的创建app函数
  const app = ensureRenderer().createApp(...args)

  // 开发中
  if (__DEV__) {
    // 检查原生标签检查属性
    injectNativeTagCheck(app)
  }

  // 获取app的安装方法
  const { mount } = app
  // 重新改写安装方法
  /**
   * 容器对象或者选择器字符串
   * @param containerOrSelector 
   */
  app.mount = (containerOrSelector: Element | string): any => {
    // 获取挂载点的dom对象
    const container = normalizeContainer(containerOrSelector)
    // 不存在，不再进行下去
    if (!container) return
    // 获取app的根组件实例
    const component = app._component
    // 非函数 && 没有render函数 && 没有template
    if (!isFunction(component) && !component.render && !component.template) {
      // 直接将挂载点中的html当作模板
      component.template = container.innerHTML
    }
    // clear content before mounting
    // 安装前清空html容器中的内容
    container.innerHTML = ''
    // 开始安装组件
    const proxy = mount(container)
    // 移除挂载店的v-cloak属性,放置闪烁
    container.removeAttribute('v-cloak')
    container.setAttribute('data-v-app', '')
    return proxy
  }

  // 返回app
  return app
}) as CreateAppFunction<Element>

export const createSSRApp = ((...args) => {
  const app = ensureHydrationRenderer().createApp(...args)

  if (__DEV__) {
    injectNativeTagCheck(app)
  }

  const { mount } = app
  app.mount = (containerOrSelector: Element | string): any => {
    const container = normalizeContainer(containerOrSelector)
    if (container) {
      return mount(container, true)
    }
  }

  return app
}) as CreateAppFunction<Element>

function injectNativeTagCheck(app: App) {
  // 注入isNativeTag属性
  // Inject `isNativeTag`
  // 这个被用来验证组件的名称
  // this is used for component name validation (dev only)
  Object.defineProperty(app.config, 'isNativeTag', {
    value: (tag: string) => isHTMLTag(tag) || isSVGTag(tag),
    writable: false
  })
}

/**
 * 标准化dom节点
 * @param container 挂载的dom节点或者选择器字符串
 */
function normalizeContainer(container: Element | string): Element | null {
  // 是字符串,说明是选择器
  if (isString(container)) {
    // 转换为dom对象
    const res = document.querySelector(container)
    // 开发中， dom对象不存在
    if (__DEV__ && !res) {
      warn(`Failed to mount app: mount target selector returned null.`)
    }
    // 获取的dom节点对象
    return res
  }
  // 非字符串,说明是dom节点对象,直接返回
  return container
}

// SFC CSS utilities
export { useCssModule } from './helpers/useCssModule'
export { useCssVars } from './helpers/useCssVars'

// DOM-only components
export { Transition, TransitionProps } from './components/Transition'
export {
  TransitionGroup,
  TransitionGroupProps
} from './components/TransitionGroup'

// **Internal** DOM-only runtime directive helpers
export {
  vModelText,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelDynamic
} from './directives/vModel'
export { withModifiers, withKeys } from './directives/vOn'
export { vShow } from './directives/vShow'

// re-export everything from core
// h, Component, reactivity API, nextTick, flags & types
export * from '@vue/runtime-core'
