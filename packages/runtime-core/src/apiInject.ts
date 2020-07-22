import { currentInstance } from './component'
import { currentRenderingInstance } from './componentRenderUtils'
import { warn } from './warning'

export interface InjectionKey<T> extends Symbol {}

/**
 * 将依赖添加到提供器中
 * @param key 
 * @param value 
 */
export function provide<T>(key: InjectionKey<T> | string, value: T) {
  if (!currentInstance) {
    if (__DEV__) {
      warn(`provide() can only be used inside setup().`)
    }
  } else {
    // 获取组件的提供器
    let provides = currentInstance.provides
    // by default an instance inherits its parent's provides object
    // but when it needs to provide values of its own, it creates its
    // own provides object using parent provides object as prototype.
    // this way in `inject` we can simply look up injections from direct
    // parent and let the prototype chain do the work.
    // 获取组件的父提供器
    const parentProvides =
      currentInstance.parent && currentInstance.parent.provides
      // 比较是否为同一个
    if (parentProvides === provides) {
      // 将父提供器继承给（当前组件实例）提供器
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    // TS doesn't allow symbol as index type
    // 添加依赖到容器中
    provides[key as string] = value
  }
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(key: InjectionKey<T> | string, defaultValue: T): T

/**
 * 将依赖注入到组件中
 * @param key 
 * @param defaultValue 
 */
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown
) {
  // 以至于这个能够被在函数式组件中调用
  // fallback to `currentRenderingInstance` so that this can be called in
  // a functional component
  const instance = currentInstance || currentRenderingInstance
  // 组件实例
  if (instance) {
    // 获取组件实例上的提供器
    const provides = instance.provides
    // 判断依赖是否在提供器中
    if (key in provides) {
      // TS doesn't allow symbol as index type
      // 存在返回依赖，从提供器中获取依赖
      return provides[key as string]
    } else if (arguments.length > 1) { // 大于2个参数
      return defaultValue
    } else if (__DEV__) { // 开发中
      // 注射器没找到
      warn(`injection "${String(key)}" not found.`)
    }
  } else if (__DEV__) {
    warn(`inject() can only be used inside setup() or functional components.`)
  }
}
