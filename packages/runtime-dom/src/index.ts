import {
  createRenderer,
  warn,
  App,
  RootRenderFunction
} from '@vue/runtime-core'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'
// Importing from the compiler, will be tree-shaken in prod
import { isFunction, isString, isHTMLTag, isSVGTag } from '@vue/shared'

const { render: baseRender, createApp: baseCreateApp } = createRenderer({
  patchProp,
  ...nodeOps
})

// use explicit type casts here to avoid import() calls in rolled-up d.ts
export const render = baseRender as RootRenderFunction<Node, Element>
// 启动框架，创建app
export const createApp = (): App<Element> => {
  // 调用apiApp.ts的createApp方法
  const app = baseCreateApp()

  if (__DEV__) {
    // Inject `isNativeTag`
    // this is used for component name validation (dev only)
    // 给app.config对象添加isNativeTag方法
    Object.defineProperty(app.config, 'isNativeTag', {
      value: (tag: string) => isHTMLTag(tag) || isSVGTag(tag),
      writable: false
    })
  }

  // 安装组件
  const mount = app.mount
  app.mount = (component, container, props): any => {
    // 容器为字符串
    if (isString(container)) {
      // 获取dom元素
      container = document.querySelector(container)!
      // 不存在
      if (!container) {
        // 开发环境
        __DEV__ &&
          warn(`Failed to mount app: mount target selector returned null.`)
        return
      }
    }
    // 浏览器script引用
    if (
      __RUNTIME_COMPILE__ && // 运行时编译
      !isFunction(component) && // 非函数
      !component.render && // 无render函数
      !component.template // 无template函数
    ) {
      component.template = container.innerHTML //
    }
    // clear content before mounting
    container.innerHTML = ''
    // 根组件  dom容器  配置属性
    return mount(component, container, props)
  }

  return app
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
