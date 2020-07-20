import { track, trigger } from './effect'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { isObject, hasChanged } from '@vue/shared'
import { reactive, isProxy, toRaw } from './reactive'
import { CollectionTypes } from './collectionHandlers'

declare const RefSymbol: unique symbol

export interface Ref<T = any> {
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  [RefSymbol]: true
  value: T
}

export type ToRefs<T = any> = { [K in keyof T]: Ref<T[K]> }

const convert = <T extends unknown>(val: T): T =>
  isObject(val) ? reactive(val) : val

export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
/**
 * 当前对象是否为ref对象
 * @param r 
 */
export function isRef(r: any): r is Ref {
  return r ? r.__v_isRef === true : false
}

export function ref<T extends object>(
  value: T
): T extends Ref ? T : Ref<UnwrapRef<T>>
export function ref<T>(value: T): Ref<UnwrapRef<T>>
export function ref<T = any>(): Ref<T | undefined>
export function ref(value?: unknown) {
  // 创建对值的引用
  return createRef(value)
}

export function shallowRef<T>(value: T): T extends Ref ? T : Ref<T>
export function shallowRef<T = any>(): Ref<T | undefined>
/**
 * 浅引用
 * @param value 
 */
export function shallowRef(value?: unknown) {
  return createRef(value, true)
}

/**
 * 返回一个对象，只有一个value属性，指向这个内部值
 * @param rawValue 原始值
 * @param shallow 浅
 */
function createRef(rawValue: unknown, shallow = false) {
  // 当前是否为
  if (isRef(rawValue)) {
    return rawValue
  }
  // 是否对值进行响应式处理
  let value = shallow ? rawValue : convert(rawValue)
  // 这个值就是根据内部之创建的ref对象
  const r = {
    __v_isRef: true,
    // vulue属性的
    // get访问器
    get value() {
      track(r, TrackOpTypes.GET, 'value')
      // 返回
      return value
    },
    // set访问器（修改内部值时）
    set value(newVal) {
      // 值是否发生变化（在set的时候
      if (hasChanged(toRaw(newVal), rawValue)) {
        // 将原始值保留下来
        rawValue = newVal
        // 将新值进行转化
        value = shallow ? newVal : convert(newVal)
        trigger(
          r,
          TriggerOpTypes.SET,
          'value',
          __DEV__ ? { newValue: newVal } : void 0
        )
      }
    }
  }
  return r
}

export function triggerRef(ref: Ref) {
  trigger(
    ref,
    TriggerOpTypes.SET,
    'value',
    __DEV__ ? { newValue: ref.value } : void 0
  )
}

// 从ref对象中获取原始值
export function unref<T>(ref: T): T extends Ref<infer V> ? V : T {
  return isRef(ref) ? (ref.value as any) : ref
}

export type CustomRefFactory<T> = (
  track: () => void,
  trigger: () => void
) => {
  get: () => T
  set: (value: T) => void
}

export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  const { get, set } = factory(
    () => track(r, TrackOpTypes.GET, 'value'),
    () => trigger(r, TriggerOpTypes.SET, 'value')
  )
  const r = {
    __v_isRef: true,
    get value() {
      return get()
    },
    set value(v) {
      set(v)
    }
  }
  return r as any
}

export function toRefs<T extends object>(object: T): ToRefs<T> {
 /* 将对象进行ref化
 * @param object 
 */
  if (__DEV__ && !isProxy(object)) {
    console.warn(`toRefs() expects a reactive object but received a plain one.`)
  }
  const ret: any = {}
  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}

// 将对象的某个属性进行ref对象化
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): Ref<T[K]> {
  return {
    __v_isRef: true,
    get value(): any {
      return object[key]
    },
    set value(newVal) {
      object[key] = newVal
    }
  } as any
}

// corner case when use narrows type
// Ex. type RelativePath = string & { __brand: unknown }
// RelativePath extends object -> true
type BaseTypes = string | number | boolean

/**
 * This is a special exported interface for other packages to declare
 * additional types that should bail out for ref unwrapping. For example
 * \@vue/runtime-dom can declare it like so in its d.ts:
 *
 * ``` ts
 * declare module '@vue/reactivity' {
 *   export interface RefUnwrapBailTypes {
 *     runtimeDOMBailTypes: Node | Window
 *   }
 * }
 * ```
 *
 * Note that api-extractor somehow refuses to include `declare module`
 * augmentations in its generated d.ts, so we have to manually append them
 * to the final generated d.ts in our build process.
 */
export interface RefUnwrapBailTypes {}

export type UnwrapRef<T> = T extends Ref<infer V>
  ? UnwrapRefSimple<V>
  : UnwrapRefSimple<T>

type UnwrapRefSimple<T> = T extends
  | Function
  | CollectionTypes
  | BaseTypes
  | Ref
  | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
  ? T
  : T extends Array<any>
    ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
    : T extends object ? UnwrappedObject<T> : T

// Extract all known symbols from an object
// when unwrapping Object the symbols are not `in keyof`, this should cover all the
// known symbols
type SymbolExtract<T> = (T extends { [Symbol.asyncIterator]: infer V }
  ? { [Symbol.asyncIterator]: V }
  : {}) &
  (T extends { [Symbol.hasInstance]: infer V }
    ? { [Symbol.hasInstance]: V }
    : {}) &
  (T extends { [Symbol.isConcatSpreadable]: infer V }
    ? { [Symbol.isConcatSpreadable]: V }
    : {}) &
  (T extends { [Symbol.iterator]: infer V } ? { [Symbol.iterator]: V } : {}) &
  (T extends { [Symbol.match]: infer V } ? { [Symbol.match]: V } : {}) &
  (T extends { [Symbol.matchAll]: infer V } ? { [Symbol.matchAll]: V } : {}) &
  (T extends { [Symbol.replace]: infer V } ? { [Symbol.replace]: V } : {}) &
  (T extends { [Symbol.search]: infer V } ? { [Symbol.search]: V } : {}) &
  (T extends { [Symbol.species]: infer V } ? { [Symbol.species]: V } : {}) &
  (T extends { [Symbol.split]: infer V } ? { [Symbol.split]: V } : {}) &
  (T extends { [Symbol.toPrimitive]: infer V }
    ? { [Symbol.toPrimitive]: V }
    : {}) &
  (T extends { [Symbol.toStringTag]: infer V }
    ? { [Symbol.toStringTag]: V }
    : {}) &
  (T extends { [Symbol.unscopables]: infer V }
    ? { [Symbol.unscopables]: V }
    : {})

type UnwrappedObject<T> = { [P in keyof T]: UnwrapRef<T[P]> } & SymbolExtract<T>
