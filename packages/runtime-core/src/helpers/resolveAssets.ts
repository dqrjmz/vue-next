import { currentRenderingInstance } from '../componentRenderUtils'
import {
  currentInstance,
  ConcreteComponent,
  FunctionalComponent,
  ComponentOptions
} from '../component'
import { Directive } from '../directives'
import { camelize, capitalize, isString } from '@vue/shared'
import { warn } from '../warning'
import { VNodeTypes } from '../vnode'

const COMPONENTS = 'components'
const DIRECTIVES = 'directives'

/**
 * @private
 */
export function resolveComponent(name: string): ConcreteComponent | string {
  return resolveAsset(COMPONENTS, name) || name
}

export const NULL_DYNAMIC_COMPONENT = Symbol()

/**
 * @private
 */
/**
 * 解析动态组件
 * @param component 组件名称
 */
export function resolveDynamicComponent(component: unknown): VNodeTypes {
  // 组件名是否为字符串
  if (isString(component)) {
    return resolveAsset(COMPONENTS, component, false) || component
  } else {
    // 无效的类型将会创建vnode落空并且提出警告
    // invalid types will fallthrough to createVNode and raise warning
    return (component || NULL_DYNAMIC_COMPONENT) as any
  }
}

/**
 * @private
 */
/**
 * 解析指令
 * @param name 指令名
 */
export function resolveDirective(name: string): Directive | undefined {
  return resolveAsset(DIRECTIVES, name)
}

/**
 * @private
 * overload 1: components
 */
function resolveAsset(
  type: typeof COMPONENTS,
  name: string,
  warnMissing?: boolean
): ConcreteComponent | undefined
// overload 2: directives
function resolveAsset(
  type: typeof DIRECTIVES,
  name: string
): Directive | undefined
// implementation
/**
 * 解析资产
 * @param type 类型
 * @param name 名称
 * @param warnMissing 
 * @returns 返回指定类型的，指定名称的实例
 */
function resolveAsset(
  type: typeof COMPONENTS | typeof DIRECTIVES,
  name: string,
  warnMissing = true
) {
  const instance = currentRenderingInstance || currentInstance
  // 存在实例
  if (instance) {
    const Component = instance.type

    // self name has highest priority
    if (type === COMPONENTS) {
      const selfName =
        (Component as FunctionalComponent).displayName || Component.name
      if (
        selfName &&
        (selfName === name ||
          selfName === camelize(name) ||
          selfName === capitalize(camelize(name)))
      ) {
        return Component
      }
    }

    const res =
      // local registration
      // check instance[type] first for components with mixin or extends.
      resolve(instance[type] || (Component as ComponentOptions)[type], name) ||
      // global registration
      resolve(instance.appContext[type], name)
    if (__DEV__ && warnMissing && !res) {
      warn(`Failed to resolve ${type.slice(0, -1)}: ${name}`)
    }
    return res
  } else if (__DEV__) {
    // 没有组件实例
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
        `can only be used in render() or setup().`
    )
  }
}

function resolve(registry: Record<string, any> | undefined, name: string) {
  return (
    registry &&
    (registry[name] ||
      registry[camelize(name)] ||
      registry[capitalize(camelize(name))])
  )
}
