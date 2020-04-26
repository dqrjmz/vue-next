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
import { patchProp } from './patchProp'
// Importing from the compiler, will be tree-shaken in prod
import { isFunction, isString, isHTMLTag, isSVGTag } from '@vue/shared'

const rendererOptions = {
  patchProp,
  ...nodeOps
}

// lazy create the renderer - this makes core renderer logic tree-shakable
// in case the user only imports reactivity utilities from Vue.
let renderer: Renderer | HydrationRenderer

let enabledHydration = false

// 获取渲染器
function ensureRenderer() {
  return renderer || (renderer = createRenderer(rendererOptions))
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

// 创建app函数
export const createApp = ((...args) => {
  // 渲染器创建app
  const app = ensureRenderer().createApp(...args)

  // 开发中
  if (__DEV__) {
    // 注入原生标签检查
    injectNativeTagCheck(app)
  }

  // 获取app的安装方法
  const { mount } = app
  // 重新改写安装方法
  app.mount = (containerOrSelector: Element | string): any => {
    // 获取挂载点的dom对象
    const container = normalizeContainer(containerOrSelector)
    // 不存在，不再进行下去
    if (!container) return
    // 获取app的根组件实例
    const component = app._component
    // 非函数，没有render函数，没有template
    if (!isFunction(component) && !component.render && !component.template) {
      // 直接将挂载点中的html当作模板
      component.template = container.innerHTML
    }
    // clear content before mounting
    // 安装前清空挂载店内容
    container.innerHTML = ''
    // 安装组件
    const proxy = mount(container)
    // 移除挂载店的v-cloak属性
    container.removeAttribute('v-cloak')
    // 安装
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
  // Inject `isNativeTag`
  // this is used for component name validation (dev only)
  Object.defineProperty(app.config, 'isNativeTag', {
    value: (tag: string) => isHTMLTag(tag) || isSVGTag(tag),
    writable: false
  })
}

/**
 * 正规化dom节点
 * @param container 挂载的dom节点
 */
function normalizeContainer(container: Element | string): Element | null {
  // 字符串
  if (isString(container)) {
    // 转换为dom对象
    const res = document.querySelector(container)
    // 开发中， dom对象不存在
    if (__DEV__ && !res) {
      warn(`Failed to mount app: mount target selector returned null.`)
    }
    // 存在之际返回
    return res
  }
  // 非字符串直接返回
  return container
}

// DOM-only runtime directive helpers
export {
  vModelText,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelDynamic
} from './directives/vModel'
export { withModifiers, withKeys } from './directives/vOn'
export { vShow } from './directives/vShow'

// DOM-only components
export { Transition, TransitionProps } from './components/Transition'
export {
  TransitionGroup,
  TransitionGroupProps
} from './components/TransitionGroup'

// re-export everything from core
// h, Component, reactivity API, nextTick, flags & types
export * from '@vue/runtime-core'
