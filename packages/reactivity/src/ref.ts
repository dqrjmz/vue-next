import { track, trigger } from './effect'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { isObject, hasChanged } from '@vue/shared'
import { reactive, isProxy, toRaw } from './reactive'
import { ComputedRef } from './computed'
import { CollectionTypes } from './collectionHandlers'

const isRefSymbol = Symbol()

export interface Ref<T = any> {
  // This field is necessary to allow TS to differentiate a Ref from a plain
  // object that happens to have a "value" field.
  // However, checking a symbol on an arbitrary object is much slower than
  // checking a plain property, so we use a _isRef plain property for isRef()
  // check in the actual implementation.
  // The reason for not just declaring _isRef in the interface is because we
  // don't want this internal field to leak into userland autocompletion -
  // a private symbol, on the other hand, achieves just that.
  [isRefSymbol]: true
  value: T
}

// 将值，为对象时，转换为响应式对象
const convert = <T extends unknown>(val: T): T =>
  isObject(val) ? reactive(val) : val

export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
/**
 * 当前对象是否为ref对象
 * @param r 
 */
export function isRef(r: any): r is Ref {
  // r对象是否存在_isRef属性
  return r ? r._isRef === true : false
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
    // 标识这个对象式ref对象
    _isRef: true,
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
    _isRef: true,
    get value() {
      return get()
    },
    set value(v) {
      set(v)
    }
  }
  return r as any
}

/**
 * 将对象进行ref化
 * @param object 
 */
export function toRefs<T extends object>(
  object: T
): { [K in keyof T]: Ref<T[K]> } {
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
    _isRef: true,
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
type BaseTypes = string | number | boolean | Node | Window

export type UnwrapRef<T> = T extends ComputedRef<infer V>
  ? UnwrapRefSimple<V>
  : T extends Ref<infer V> ? UnwrapRefSimple<V> : UnwrapRefSimple<T>

type UnwrapRefSimple<T> = T extends Function | CollectionTypes | BaseTypes | Ref
  ? T
  : T extends Array<any> ? T : T extends object ? UnwrappedObject<T> : T

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
