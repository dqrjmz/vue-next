import { isObject, toRawType } from '@vue/shared'
// 不同情况下的代理处理
import {
  // 可变的
  mutableHandlers,
  // 只读的
  readonlyHandlers,
  // 浅响应式
  shallowReactiveHandlers,
  // 浅只读
  shallowReadonlyHandlers
} from './baseHandlers'
import {
  // 可变集合
  mutableCollectionHandlers,
  // 只读集合
  readonlyCollectionHandlers
} from './collectionHandlers'
import { UnwrapRef, Ref } from './ref'
import { makeMap } from '@vue/shared'

// WeakMaps that store {raw <-> observed} pairs.
const rawToReactive = new WeakMap<any, any>()

const reactiveToRaw = new WeakMap<any, any>()
// 原生到只读
const rawToReadonly = new WeakMap<any, any>()
// 只读到原生
const readonlyToRaw = new WeakMap<any, any>()

// WeakSets for values that are marked readonly or non-reactive during
// observable creation.
// 被标识为只读或者非响应式，在可观察创建期间
const rawValues = new WeakSet<any>()

const collectionTypes = new Set<Function>([Set, Map, WeakMap, WeakSet])
// 是否是可观察类型
const isObservableType = /*#__PURE__*/ makeMap(
  'Object,Array,Map,Set,WeakMap,WeakSet'
)

/**
 * 可观察
 * @param value 代理的目标对象
 */
const canObserve = (value: any): boolean => {
  return (
    // 值不是vue实例
    !value._isVue &&
    // 值不是vnode
    !value._isVNode &&
    // 能够被观察（可代理
    isObservableType(toRawType(value)) &&
    // 不再其中
    !rawValues.has(value) &&
    // 对像没有被冻结
    !Object.isFrozen(value)
  )
}

// only unwrap nested ref
type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>

export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
/**
 * 
 * @param target 目标对象
 */
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  // 已经被设置过的
  if (readonlyToRaw.has(target)) {
    // 直接返回
    return target
  }
  // 创建响应式对象
  return createReactiveObject(
    target,
    rawToReactive,
    reactiveToRaw,
    mutableHandlers,
    mutableCollectionHandlers
  )
}

// Return a reactive-copy of the original object, where only the root level
// properties are reactive, and does NOT unwrap refs nor recursively convert
// returned properties.
export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    rawToReactive,
    reactiveToRaw,
    shallowReactiveHandlers,
    mutableCollectionHandlers
  )
}

/**
 * 将对象设置为只读
 * @param target 目标对象
 */
export function readonly<T extends object>(
  target: T
): Readonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    rawToReadonly,
    readonlyToRaw,
    readonlyHandlers,
    readonlyCollectionHandlers
  )
}

// Return a reactive-copy of the original object, where only the root level
// properties are readonly, and does NOT unwrap refs nor recursively convert
// returned properties.
// This is used for creating the props proxy object for stateful components.
export function shallowReadonly<T extends object>(
  target: T
): Readonly<{ [K in keyof T]: UnwrapNestedRefs<T[K]> }> {
  return createReactiveObject(
    target,
    rawToReadonly,
    readonlyToRaw,
    shallowReadonlyHandlers,
    readonlyCollectionHandlers
  )
}

/**
 * 
 * @param target 目标对象
 * @param toProxy 代理对象集合
 * @param toRaw 目标对象集合
 * @param baseHandlers 基础对象处理（根据不同情况传入不同的代理函数
 * @param collectionHandlers 集合对象处理
 */
function createReactiveObject(
  target: unknown,
  toProxy: WeakMap<any, any>,
  toRaw: WeakMap<any, any>,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>
) {
  // 不是一个object类型，非null的,typeof的object
  if (!isObject(target)) {
    // 开发中
    if (__DEV__) {
      // 警告： 值不能被做成响应式
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    // 直接返回
    return target
  }
  // target already has corresponding Proxy
  // 目标对象已经有对应的代理对象
  let observed = toProxy.get(target)
  // 代理对象不是undefined
  if (observed !== void 0) {
    // 直接返回代理对象
    return observed
  }
  // target is already a Proxy
  // 目标对象已经是一个代理
  if (toRaw.has(target)) {
    // 直接返回
    return target
  }
  // only a whitelist of value types can be observed.
  // 只有一个值的白名单类型能够被观察
  if (!canObserve(target)) {
    // 不能被观察直接返回
    return target
  }
  /**
   * 目标对象的代理处理（根据目标对象的构造函数，返回合适的代理处理,根据集合对象的类型，来判断使用某种代理
   * 1. 集合对象 Map,Set WeakMap，WeakSet ，这里只拦截了get方法
   * 2. 基础对象 Object,Array，这里拦截了，get,set,deleteProperty，has,ownkeys
   */
  const handlers = collectionTypes.has(target.constructor)
    ? collectionHandlers
    : baseHandlers
    // 创建代理对象
  observed = new Proxy(target, handlers)
  // 缓存下来
  // 代理对象
  toProxy.set(target, observed)
  // 原始对象
  toRaw.set(observed, target)
  // 返回目标对象的代理对象
  return observed
}

/**
 * 对象是否为响应式对象
 * @param value 
 */
export function isReactive(value: unknown): boolean {
  value = readonlyToRaw.get(value) || value
  return reactiveToRaw.has(value)
}

// 是否为只读对象
export function isReadonly(value: unknown): boolean {
  return readonlyToRaw.has(value)
}

// 是代理对象
export function isProxy(value: unknown): boolean {
  return readonlyToRaw.has(value) || reactiveToRaw.has(value)
}

// 是原始值
export function toRaw<T>(observed: T): T {
  observed = readonlyToRaw.get(observed) || observed
  return reactiveToRaw.get(observed) || observed
}

export function markRaw<T extends object>(value: T): T {
  rawValues.add(value)
  return value
}
