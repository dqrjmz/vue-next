import { isObject, toRawType, def, hasOwn, makeMap } from '@vue/shared'
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
  readonlyCollectionHandlers,
  shallowCollectionHandlers
} from './collectionHandlers'
import { UnwrapRef, Ref } from './ref'

export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  RAW = '__v_raw',
  REACTIVE = '__v_reactive',
  READONLY = '__v_readonly'
}

interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.RAW]?: any
  [ReactiveFlags.REACTIVE]?: any
  [ReactiveFlags.READONLY]?: any
}

const collectionTypes = new Set<Function>([Set, Map, WeakMap, WeakSet])
// 是否是可观察类型
const isObservableType = /*#__PURE__*/ makeMap(
  'Object,Array,Map,Set,WeakMap,WeakSet'
)

const canObserve = (value: Target): boolean => {
 * 可观察
 * @param value 代理的目标对象
 */
  return (
    !value[ReactiveFlags.SKIP] &&
    // 值不是vnode
    // 能够被观察（可代理
    isObservableType(toRawType(value)) &&
    // 不再其中
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
  if (target && (target as Target)[ReactiveFlags.IS_READONLY]) {
    // 直接返回
    return target
  }
  // 创建响应式对象
  return createReactiveObject(
    target,
    false,
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
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers
  )
}

/**
 * 将对象设置为只读
 * @param target 目标对象
 */
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends WeakMap<infer K, infer V>
        ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
        : T extends Set<infer U>
          ? ReadonlySet<DeepReadonly<U>>
          : T extends ReadonlySet<infer U>
            ? ReadonlySet<DeepReadonly<U>>
            : T extends WeakSet<infer U>
              ? WeakSet<DeepReadonly<U>>
              : T extends Promise<infer U>
                ? Promise<DeepReadonly<U>>
                : T extends {}
                  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
                  : Readonly<T>

export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
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
    true,
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
  target: Target,
  isReadonly: boolean,
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
  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
  // 目标对象已经是一个代理
    // 直接返回
    return target
  }
  // target already has corresponding Proxy
  if (
    hasOwn(target, isReadonly ? ReactiveFlags.READONLY : ReactiveFlags.REACTIVE)
  ) {
    return isReadonly
      ? target[ReactiveFlags.READONLY]
      : target[ReactiveFlags.REACTIVE]
  }
  // only a whitelist of value types can be observed.
  // 只有一个值的白名单类型能够被观察
  if (!canObserve(target)) {
    // 不能被观察直接返回
    return target
  }
  const observed = new Proxy(
    target,
    collectionTypes.has(target.constructor) ? collectionHandlers : baseHandlers
  )
  def(
    target,
    isReadonly ? ReactiveFlags.READONLY : ReactiveFlags.REACTIVE,
    observed
  )
  // 缓存下来
  // 代理对象
  // 原始对象
  // 返回目标对象的代理对象
  return observed
}

/**
 * 对象是否为响应式对象
 * @param value 
 */
export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

// 是否为只读对象
export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}

// 是代理对象
export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

// 是原始值
export function toRaw<T>(observed: T): T {
  return (
    (observed && toRaw((observed as Target)[ReactiveFlags.RAW])) || observed
  )
}

export function markRaw<T extends object>(value: T): T {
  def(value, ReactiveFlags.SKIP, true)
  return value
}
