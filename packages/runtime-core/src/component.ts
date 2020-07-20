import { VNode, VNodeChild, isVNode } from './vnode'
import {
  reactive,
  ReactiveEffect,
  pauseTracking,
  resetTracking,
  shallowReadonly
} from '@vue/reactivity'
import {
  CreateComponentPublicInstance,
  ComponentPublicInstance,
  PublicInstanceProxyHandlers,
  RuntimeCompiledPublicInstanceProxyHandlers,
  createRenderContext,
  exposePropsOnRenderContext,
  exposeSetupStateOnRenderContext
} from './componentProxy'
import {
  ComponentPropsOptions,
  NormalizedPropsOptions,
  initProps
} from './componentProps'
import { Slots, initSlots, InternalSlots } from './componentSlots'
import { warn } from './warning'
import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { AppContext, createAppContext, AppConfig } from './apiCreateApp'
import { Directive, validateDirectiveName } from './directives'
import { applyOptions, ComponentOptions } from './componentOptions'
import {
  EmitsOptions,
  ObjectEmitsOptions,
  EmitFn,
  emit
} from './componentEmits'
import {
  EMPTY_OBJ,
  isFunction,
  NOOP,
  isObject,
  NO,
  makeMap,
  isPromise,
  ShapeFlags
} from '@vue/shared'
import { SuspenseBoundary } from './components/Suspense'
import { CompilerOptions } from '@vue/compiler-core'
import {
  currentRenderingInstance,
  markAttrsAccessed
} from './componentRenderUtils'
import { startMeasure, endMeasure } from './profiling'
import { componentAdded } from './devtools'

export type Data = Record<string, unknown>

/**
 * For extending allowed non-declared props on components in TSX
 */
export interface ComponentCustomProps {}

/**
 * Default allowed non-declared props on ocmponent in TSX
 */
export interface AllowedComponentProps {
  class?: unknown
  style?: unknown
}

// Note: can't mark this whole interface internal because some public interfaces
// extend it.
export interface ComponentInternalOptions {
  /**
   * @internal
   */
  __props?: NormalizedPropsOptions | []
  /**
   * @internal
   */
  __emits?: ObjectEmitsOptions
  /**
   * @internal
   */
  __scopeId?: string
  /**
   * @internal
   */
  __cssModules?: Data
  /**
   * @internal
   */
  __hmrId?: string
  /**
   * This one should be exposed so that devtools can make use of it
   */
  __file?: string
}

export interface FunctionalComponent<P = {}, E extends EmitsOptions = {}>
  extends ComponentInternalOptions {
  // use of any here is intentional so it can be a valid JSX Element constructor
  (props: P, ctx: SetupContext<E>): any
  props?: ComponentPropsOptions<P>
  emits?: E | (keyof E)[]
  inheritAttrs?: boolean
  displayName?: string
}

export interface ClassComponent {
  new (...args: any[]): ComponentPublicInstance<any, any, any, any, any>
  __vccOpts: ComponentOptions
}

export type Component = ComponentOptions | FunctionalComponent<any>

// A type used in public APIs where a component type is expected.
// The constructor type is an artificial type returned by defineComponent().
export type PublicAPIComponent =
  | Component
  | {
      new (...args: any[]): CreateComponentPublicInstance<
        any,
        any,
        any,
        any,
        any
      >
    }

export { ComponentOptions }

type LifecycleHook = Function[] | null

export const enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm',
  BEFORE_UPDATE = 'bu',
  UPDATED = 'u',
  BEFORE_UNMOUNT = 'bum',
  UNMOUNTED = 'um',
  DEACTIVATED = 'da',
  ACTIVATED = 'a',
  RENDER_TRIGGERED = 'rtg',
  RENDER_TRACKED = 'rtc',
  ERROR_CAPTURED = 'ec'
}

export interface SetupContext<E = EmitsOptions> {
  attrs: Data
  slots: Slots
  emit: EmitFn<E>
}

/**
 * @internal
 */
export type InternalRenderFunction = {
  (
    ctx: ComponentPublicInstance,
    cache: ComponentInternalInstance['renderCache'],
    // for compiler-optimized bindings
    $props: ComponentInternalInstance['props'],
    $setup: ComponentInternalInstance['setupState'],
    $data: ComponentInternalInstance['data'],
    $options: ComponentInternalInstance['ctx']
  ): VNodeChild
  _rc?: boolean // isRuntimeCompiled
}

/**
 * We expose a subset of properties on the internal instance as they are
 * useful for advanced external libraries and tools.
 */
export interface ComponentInternalInstance {
  uid: number
  type: Component
  parent: ComponentInternalInstance | null
  root: ComponentInternalInstance
  appContext: AppContext
  /**
   * Vnode representing this component in its parent's vdom tree
   */
  vnode: VNode
  /**
   * The pending new vnode from parent updates
   * @internal
   */
  next: VNode | null
  /**
   * Root vnode of this component's own vdom tree
   */
  subTree: VNode
  /**
   * The reactive effect for rendering and patching the component. Callable.
   */
  update: ReactiveEffect
  /**
   * The render function that returns vdom tree.
   * @internal
   */
  render: InternalRenderFunction | null
  /**
   * Object containing values this component provides for its descendents
   * @internal
   */
  provides: Data
  /**
   * Tracking reactive effects (e.g. watchers) associated with this component
   * so that they can be automatically stopped on component unmount
   * @internal
   */
  effects: ReactiveEffect[] | null
  /**
   * cache for proxy access type to avoid hasOwnProperty calls
   * @internal
   */
  accessCache: Data | null
  /**
   * cache for render function values that rely on _ctx but won't need updates
   * after initialized (e.g. inline handlers)
   * @internal
   */
  renderCache: (Function | VNode)[]

  /**
   * Asset hashes that prototypally inherits app-level asset hashes for fast
   * resolution
   * @internal
   */
  components: Record<string, Component>
  /**
   * @internal
   */
  directives: Record<string, Directive>

  // the rest are only for stateful components ---------------------------------

  // main proxy that serves as the public instance (`this`)
  proxy: ComponentPublicInstance | null

  /**
   * alternative proxy used only for runtime-compiled render functions using
   * `with` block
   * @internal
   */
  withProxy: ComponentPublicInstance | null
  /**
   * This is the target for the public instance proxy. It also holds properties
   * injected by user options (computed, methods etc.) and user-attached
   * custom properties (via `this.x = ...`)
   * @internal
   */
  ctx: Data

  // internal state
  data: Data
  props: Data
  attrs: Data
  slots: InternalSlots
  refs: Data
  emit: EmitFn
  // used for keeping track of .once event handlers on components
  emitted: Record<string, boolean> | null

  /**
   * setup related
   * @internal
   */
  setupState: Data
  /**
   * @internal
   */
  setupContext: SetupContext | null

  /**
   * suspense related
   * @internal
   */
  suspense: SuspenseBoundary | null
  /**
   * @internal
   */
  asyncDep: Promise<any> | null
  /**
   * @internal
   */
  asyncResolved: boolean

  // lifecycle
  isMounted: boolean
  isUnmounted: boolean
  isDeactivated: boolean
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_CREATE]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.CREATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.MOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.UPDATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.UNMOUNTED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.RENDER_TRACKED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.RENDER_TRIGGERED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.ACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.DEACTIVATED]: LifecycleHook
  /**
   * @internal
   */
  [LifecycleHooks.ERROR_CAPTURED]: LifecycleHook
}

const emptyAppContext = createAppContext()

// 创建组件实例
let uid = 0

/**
 * 创建组件实例
 * @param vnode 
 * @param parent 
 * @param suspense 
 */
export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  suspense: SuspenseBoundary | null
) {
  // inherit parent app context - or - if root, adopt from root vnode
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext
    // 组件内部实例
  const instance: ComponentInternalInstance = {
    uid: uid++,
    vnode,
    parent,
    appContext,
    type: vnode.type as Component, //虚拟节点类型
    root: null!, // set later so it can point to itself
    next: null,
    subTree: null!, // will be set synchronously right after creation
    update: null!, // will be set synchronously right after creation
    render: null,
    proxy: null,
    withProxy: null,
    effects: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),
    accessCache: null!,
    renderCache: [],

    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,

    // per-instance asset storage (mutable during options resolution)
    components: Object.create(appContext.components),
    directives: Object.create(appContext.directives),

    // suspense related
    suspense,
    asyncDep: null,
    asyncResolved: false,

    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    emit: null as any, // to be set immediately
    emitted: null
  }
  if (__DEV__) {
    instance.ctx = createRenderContext(instance)
  } else {
    instance.ctx = { _: instance }
  }
  instance.root = parent ? parent.root : instance
  instance.emit = emit.bind(null, instance)

  __DEV__ && componentAdded(instance)

  return instance
}

export let currentInstance: ComponentInternalInstance | null = null

// 获取组件实例
export const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance || currentRenderingInstance

  // 设置组件实例
export const setCurrentInstance = (
  instance: ComponentInternalInstance | null
) => {
  currentInstance = instance
}

// 是否是内置的标签
const isBuiltInTag = /*#__PURE__*/ makeMap('slot,component')

// 验证组件名称
export function validateComponentName(name: string, config: AppConfig) {
  const appIsNativeTag = config.isNativeTag || NO
  if (isBuiltInTag(name) || appIsNativeTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component id: ' + name
    )
  }
}

export let isInSSRComponentSetup = false

export function setupComponent(
  // 组件内部实例
  instance: ComponentInternalInstance,
  isSSR = false
) {
  isInSSRComponentSetup = isSSR

  const { props, children, shapeFlag } = instance.vnode
  const isStateful = shapeFlag & ShapeFlags.STATEFUL_COMPONENT
  // 初始化Prop,Slot
  initProps(instance, props, isStateful, isSSR)
  initSlots(instance, children)

  const setupResult = isStateful
  // 安装有状态组件
    ? setupStatefulComponent(instance, isSSR)
    : undefined
  isInSSRComponentSetup = false
  return setupResult
}

/**
 * 安装有状态组件
 * @param instance 
 * @param isSSR 
 */
function setupStatefulComponent(
  instance: ComponentInternalInstance,
  isSSR: boolean
) {
  // 组件实例的type属性
  const Component = instance.type as ComponentOptions 

  if (__DEV__) {
    if (Component.name) {
      validateComponentName(Component.name, instance.appContext.config)
    }
    if (Component.components) {
      const names = Object.keys(Component.components)
      for (let i = 0; i < names.length; i++) {
        validateComponentName(names[i], instance.appContext.config)
      }
    }
    if (Component.directives) {
      const names = Object.keys(Component.directives)
      for (let i = 0; i < names.length; i++) {
        validateDirectiveName(names[i])
      }
    }
  }
  // 通过缓存创建渲染代理属性
  // 0. create render proxy property access cache
  instance.accessCache = {}
  // 创建公共实例/渲染代理,还标记他,所以他不会被观察
  // 1. create public instance / render proxy
  // also mark it raw so it's never observed
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)
  if (__DEV__) {
    exposePropsOnRenderContext(instance)
  }
  // 2. call setup()
  const { setup } = Component
  if (setup) {
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null)

    currentInstance = instance
    pauseTracking()
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      ErrorCodes.SETUP_FUNCTION,
      // 组件的props属性
      [__DEV__ ? shallowReadonly(instance.props) : instance.props, setupContext]
    )
    resetTracking()
    // 当前组件
    currentInstance = null
      // 是Promise类型数据
    if (isPromise(setupResult)) {
      if (isSSR) {
        // return the promise so server-renderer can wait on it
        return setupResult.then((resolvedResult: unknown) => {
          handleSetupResult(instance, resolvedResult, isSSR)
        })
      } else if (__FEATURE_SUSPENSE__) {
        // async setup returned Promise.
        // bail here and wait for re-entry.
        instance.asyncDep = setupResult
      } else if (__DEV__) {
        // setup不支持返回Promise
        warn(
          `setup() returned a Promise, but the version of Vue you are using ` +
            `does not support it yet.`
        )
      }
    } else {
      handleSetupResult(instance, setupResult, isSSR)
    }
  } else {
    finishComponentSetup(instance, isSSR)
  }
}

/**
 * 处理setupResult
 * @param instance 组件实例 
 * @param setupResult setupResult数据
 * @param isSSR 
 */
export function handleSetupResult(
  instance: ComponentInternalInstance,
  setupResult: unknown,
  isSSR: boolean
) {
  // 返回的是函数
  if (isFunction(setupResult)) {
    // setup returned an inline render function
    // 当作组件的render函数
    instance.render = setupResult as InternalRenderFunction
    // 是对象
  } else if (isObject(setupResult)) {
    // 是vnode
    if (__DEV__ && isVNode(setupResult)) {
      // 不应该直接返回vnode,应该返回一个渲染函数
      warn(
        `setup() should not return VNodes directly - ` +
          `return a render function instead.`
      )
    }
    // setup returned bindings.
    // assuming a render function compiled from template is present.
    // 
    instance.setupState = reactive(setupResult)
    if (__DEV__) {
      exposeSetupStateOnRenderContext(instance)
    }
  } else if (__DEV__ && setupResult !== undefined) {
    warn(
      `setup() should return an object. Received: ${
        setupResult === null ? 'null' : typeof setupResult
      }`
    )
  }
  // 完成组件安装
  finishComponentSetup(instance, isSSR)
}

type CompileFunction = (
  template: string | object,
  options?: CompilerOptions
) => InternalRenderFunction

let compile: CompileFunction | undefined

/**
 * 给runtime-dom用来注册编译器的
 * For runtime-dom to register the compiler.
 * Note the exported method uses any to avoid d.ts relying on the compiler types.
 */
export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
}

/**
 * 完成组件安装
 * @param instance 组件实例
 * @param isSSR 
 */
function finishComponentSetup(
  instance: ComponentInternalInstance,
  isSSR: boolean
) {
  // 获取组件选项参数
  const Component = instance.type as ComponentOptions

  // template / render function normalization
  if (__NODE_JS__ && isSSR) {
    if (Component.render) {
      instance.render = Component.render as InternalRenderFunction
    }
    // 没有渲染函数
  } else if (!instance.render) {
    // 编译函数存在 && 组件模板存在 && 组件配置选项中没有render
    if (compile && Component.template && !Component.render) {
      // 开始测量性能
      if (__DEV__) {
        startMeasure(instance, `compile`)
      }
      // 开始编译,编译出来render function
      Component.render = compile(Component.template, {
        // 自定义元素
        isCustomElement: instance.appContext.config.isCustomElement || NO
      })

      if (__DEV__) {
        endMeasure(instance, `compile`)
      }
      // mark the function as runtime compiled
      ;(Component.render as InternalRenderFunction)._rc = true
    }

    if (__DEV__ && !Component.render) {
      /* istanbul ignore if */
      if (!compile && Component.template) {
        warn(
          `Component provided template option but ` +
            `runtime compilation is not supported in this build of Vue.` +
            (__ESM_BUNDLER__
              ? ` Configure your bundler to alias "vue" to "vue/dist/vue.esm-bundler.js".`
              : __ESM_BROWSER__
                ? ` Use "vue.esm-browser.js" instead.`
                : __GLOBAL__
                  ? ` Use "vue.global.js" instead.`
                  : ``) /* should not happen */
        )
      } else {
        warn(`Component is missing template or render function.`)
      }
    }

    // 给组件render属性赋值为render 函数
    instance.render = (Component.render || NOOP) as InternalRenderFunction

    // for runtime-compiled render functions using `with` blocks, the render
    // proxy used needs a different `has` handler which is more performant and
    // also only allows a whitelist of globals to fallthrough.
    // 还只允许全局白名单
    if (instance.render._rc) {
      instance.withProxy = new Proxy(
        instance.ctx,
        RuntimeCompiledPublicInstanceProxyHandlers
      )
    }
  }

  // support for 2.x options
  if (__FEATURE_OPTIONS__) {
    currentInstance = instance
    applyOptions(instance, Component)
    currentInstance = null
  }

  console.log(instance);
}

const attrHandlers: ProxyHandler<Data> = {
  get: (target, key: string) => {
    if (__DEV__) {
      markAttrsAccessed()
    }
    return target[key]
  },
  set: () => {
    warn(`setupContext.attrs is readonly.`)
    return false
  },
  deleteProperty: () => {
    warn(`setupContext.attrs is readonly.`)
    return false
  }
}

function createSetupContext(instance: ComponentInternalInstance): SetupContext {
  if (__DEV__) {
    // We use getters in dev in case libs like test-utils overwrite instance
    // properties (overwrites should not be done in prod)
    return Object.freeze({
      get attrs() {
        return new Proxy(instance.attrs, attrHandlers)
      },
      get slots() {
        return shallowReadonly(instance.slots)
      },
      get emit() {
        return (event: string, ...args: any[]) => instance.emit(event, ...args)
      }
    })
  } else {
    return {
      attrs: instance.attrs,
      slots: instance.slots,
      emit: instance.emit
    }
  }
}

// record effects created during a component's setup() so that they can be
// stopped when the component unmounts
export function recordInstanceBoundEffect(effect: ReactiveEffect) {
  if (currentInstance) {
    ;(currentInstance.effects || (currentInstance.effects = [])).push(effect)
  }
}

const classifyRE = /(?:^|[-_])(\w)/g
const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

/* istanbul ignore next */
export function formatComponentName(
  instance: ComponentInternalInstance | null,
  Component: Component,
  isRoot = false
): string {
  let name = isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.vue$/)
    if (match) {
      name = match[1]
    }
  }

  if (!name && instance && instance.parent) {
    // try to infer the name based on local resolution
    const registry = instance.parent.components
    for (const key in registry) {
      if (registry[key] === Component) {
        name = key
        break
      }
    }
  }

  return name ? classify(name) : isRoot ? `App` : `Anonymous`
}
