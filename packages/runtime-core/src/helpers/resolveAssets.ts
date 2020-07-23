import { currentRenderingInstance } from '../componentRenderUtils'
import { currentInstance, Component, FunctionalComponent } from '../component'
import { Directive } from '../directives'
import { camelize, capitalize, isString } from '@vue/shared'
import { warn } from '../warning'
import { VNodeTypes } from '../vnode'

const COMPONENTS = 'components'
const DIRECTIVES = 'directives'

/**
 * @private
 */
/**
 * 解析组件
 * @param name 组件名称
 */
export function resolveComponent(name: string): Component | string | undefined {
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
): Component | undefined
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
    let camelized, capitalized
    // 获取资源的容器对象
    const registry = instance[type]
    // 获取容器对象中，指定名称的元素，或者将名称进行变换
    let res =
      registry[name] ||
      registry[(camelized = camelize(name))] ||
      registry[(capitalized = capitalize(camelized))]

      // 没有指定的资产元素 && 是组件类型
    if (!res && type === COMPONENTS) {
      // 组件实例的type属性，组件的配置选项参数
      const self = instance.type
      // 组件名称
      const selfName = (self as FunctionalComponent).displayName || self.name
      // 名称相同，就将组件选项参数赋值给res
      if (
        selfName &&
        (selfName === name ||
          selfName === camelized ||
          selfName === capitalized)
      ) {
        res = self
      }
    }
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
