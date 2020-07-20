import { makeMap } from './makeMap'

export { makeMap }
export * from './patchFlags'
export * from './shapeFlags'
export * from './slotFlags'
export * from './globalsWhitelist'
export * from './codeframe'
export * from './mockWarn'
export * from './normalizeProp'
export * from './domTagConfig'
export * from './domAttrConfig'
export * from './escapeHtml'
export * from './looseEqual'
export * from './toDisplayString'

/**
 * List of @babel/parser plugins that are used for template expression
 * transforms and SFC script transforms. By default we enable proposals slated
 * for ES2020. This will need to be updated as the spec moves forward.
 * Full list at https://babeljs.io/docs/en/next/babel-parser#plugins
 */
export const babelParserDefautPlugins = [
  'bigInt',
  'optionalChaining',
  'nullishCoalescingOperator'
] as const

export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__
  ? Object.freeze({})
  : {}
export const EMPTY_ARR: [] = []

export const NOOP = () => {}

/**
 * Always return false.
 */
export const NO = () => false

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const extend = Object.assign

export const remove = <T>(arr: T[], el: T) => {
  const i = arr.indexOf(el)
  if (i > -1) {
    arr.splice(i, 1)
  }
}

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

// 是否为数组
export const isArray = Array.isArray
// val是否是Date(instanceof)
export const isDate = (val: unknown): val is Date => val instanceof Date
// val是否是function typeof
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'
  // val是否是字符串类型(typeof)
export const isString = (val: unknown): val is string => typeof val === 'string'
// val是否是symbol(typeof)
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'
// val!==null && 但,是'object',是否为object类型
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'
// 是否是Promise类型
export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  // 是对象 && 属性then是函数 && 属性catch是函数
  return isObject(val) && isFunction(val.then) && isFunction(val.catch)
}

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

  // 获取值的真实类型，Object,Array，Number,String,Boolean,RegExp,Date等（获取的是对象类型）
export const toRawType = (value: unknown): string => {
  return toTypeString(value).slice(8, -1)
}

export const isPlainObject = (val: unknown): val is object =>
  toTypeString(val) === '[object Object]'

export const isReservedProp = /*#__PURE__*/ makeMap(
  'key,ref,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted'
)

const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null)
  return ((str: string) => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }) as any
}

const camelizeRE = /-(\w)/g
/**
 * @private
 */
export const camelize = cacheStringFunction(
  (str: string): string => {
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
  }
)

const hyphenateRE = /\B([A-Z])/g
/**
 * @private
 */
export const hyphenate = cacheStringFunction(
  (str: string): string => {
    return str.replace(hyphenateRE, '-$1').toLowerCase()
  }
)

/**
 * @private
 */
export const capitalize = cacheStringFunction(
  (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
)

// compare whether a value has changed, accounting for NaN.
// 比较是否一个值已经被改变
export const hasChanged = (value: any, oldValue: any): boolean =>
// 新值不等于老值，新值全等新值或者老值全等老值
  value !== oldValue && (value === value || oldValue === oldValue)

export const invokeArrayFns = (fns: Function[], arg?: any) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg)
  }
}

export const def = (obj: object, key: string | symbol, value: any) => {
  //  给对象定义,可配置可配置,不可枚举属性
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  })
}

// 将变量转换为数值类型
export const toNumber = (val: any): any => {
  // 解析为float
  const n = parseFloat(val)
  // NaN返回val,否则返回数值n
  return isNaN(n) ? val : n
}
