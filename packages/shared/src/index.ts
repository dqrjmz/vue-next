import { makeMap } from './makeMap'

export { makeMap }
export * from './patchFlags'
export * from './shapeFlags'
export * from './slotFlags'
export * from './globalsWhitelist'
export * from './codeframe'
export * from './normalizeProp'
export * from './domTagConfig'
export * from './domAttrConfig'
export * from './escapeHtml'
export * from './looseEqual'
export * from './toDisplayString'

/**
 * babel解析器列表被用来转换模板表达式和单文件脚本，默认我们开启es2020的提案
 * 这将需要作为规格移除之前被更新
 * List of @babel/parser plugins that are used for template expression
 * transforms and SFC script transforms. By default we enable proposals slated
 * for ES2020. This will need to be updated as the spec moves forward.
 * Full list at https://babeljs.io/docs/en/next/babel-parser#plugins
 */
export const babelParserDefaultPlugins = [
  'bigInt',
  'optionalChaining',
  'nullishCoalescingOperator'
] as const

export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__
  ? Object.freeze({})
  : {}
export const EMPTY_ARR: [] = []

export const NOOP = () => { }

/**
 * Always return false.
 */
export const NO = () => false

const onRE = /^on[^a-z]/
// on开头的字符串
export const isOn = (key: string) => onRE.test(key)

export const isModelListener = (key: string) => key.startsWith('onUpdate:')

export const extend = Object.assign

/**
 * 从数组中将指定的元素移除掉
 * @param arr 
 * @param el 
 */
export const remove = <T>(arr: T[], el: T) => {
  const i = arr.indexOf(el)
  if (i > -1) {
    arr.splice(i, 1)
  }
}

// 缓存hasOwnProperty方法
const hasOwnProperty = Object.prototype.hasOwnProperty
// 简写这个方法
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

// 缓存toString方法
export const objectToString = Object.prototype.toString
// 使用不同类型数据调用toString方法
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

// 获取值的真实类型，Object,Array，Number,String,Boolean,RegExp,Date等（获取的是对象类型）
export const toRawType = (value: unknown): string => {
  // 截取类型部分字符串
  return toTypeString(value).slice(8, -1)
}
// 普通对象
export const isPlainObject = (val: unknown): val is object =>
  toTypeString(val) === '[object Object]'

export const isIntegerKey = (key: unknown) =>
  isString(key) && key[0] !== '-' && '' + parseInt(key, 10) === key

export const isReservedProp = /*#__PURE__*/ makeMap(
  'key,ref,' +
  'onVnodeBeforeMount,onVnodeMounted,' +
  'onVnodeBeforeUpdate,onVnodeUpdated,' +
  'onVnodeBeforeUnmount,onVnodeUnmounted'
)

/**
 * 缓存方法，将对应的字符串的处理结果添加到缓存记录中
 * @param fn 
 */
const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null)
  return ((str: string) => {
    // 获取缓存
    const hit = cache[str]
    // 有直接返回 没有 进行处理
    return hit || (cache[str] = fn(str))
  }) as any
}

const camelizeRE = /-(\w)/g
/**
 * @private
 */
export const camelize = cacheStringFunction(
  (str: string): string => {
    // 将字符串中 -a 模式中的字符，进行大写转换，没有返回 ''
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
  }
)

const hyphenateRE = /\B([A-Z])/g
/**
 * @private
 */
export const hyphenate = cacheStringFunction(
  (str: string): string => {
    // 将字符串中的大写字符，转换为 -$1, $1,$2...代表组合模式获取的元素
    return str.replace(hyphenateRE, '-$1').toLowerCase()
  }
)

/**
 * @private
 */
export const capitalize = cacheStringFunction(
  (str: string): string => {
    // 将字符串的第一个字符转大写，其他不变
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
)

// compare whether a value has changed, accounting for NaN.
// 比较是否一个值已经被改变
export const hasChanged = (value: any, oldValue: any): boolean =>
  // 新值不等于老值，新值全等新值或者老值全等老值
  value !== oldValue && (value === value || oldValue === oldValue)

/**
 * 调用 函数类型数组
 * @param fns 函数
 * @param arg 参数
 */
export const invokeArrayFns = (fns: Function[], arg?: any) => {
  for (let i = 0; i < fns.length; i++) {
    // 调用
    fns[i](arg)
  }
}

/**
 * 定义对象属性（可配置，不可枚举
 * @param obj 目标对象
 * @param key 属性
 * @param value 值
 */
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

let _globalThis: any
export const getGlobalThis = (): any => {
  return (
    _globalThis ||
    (_globalThis =
      typeof globalThis !== 'undefined'
        ? globalThis
        : typeof self !== 'undefined'
          ? self
          : typeof window !== 'undefined'
            ? window
            : typeof global !== 'undefined'
              ? global
              : {})
  )
}
