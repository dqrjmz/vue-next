import {
  Component,
  Data,
  validateComponentName,
  PublicAPIComponent
} from './component'
import { ComponentOptions } from './componentOptions'
import { ComponentPublicInstance } from './componentProxy'
import { Directive, validateDirectiveName } from './directives'
import { RootRenderFunction } from './renderer'
import { InjectionKey } from './apiInject'
import { isFunction, NO, isObject } from '@vue/shared'
import { warn } from './warning'
import { createVNode, cloneVNode, VNode } from './vnode'
import { RootHydrateFunction } from './hydration'
import { initApp, appUnmounted } from './devtools'
import { version } from '.'

export interface App<HostElement = any> {
  version: string
  config: AppConfig
  use(plugin: Plugin, ...options: any[]): this
  mixin(mixin: ComponentOptions): this
  component(name: string): PublicAPIComponent | undefined
  component(name: string, component: PublicAPIComponent): this
  directive(name: string): Directive | undefined
  directive(name: string, directive: Directive): this
  mount(
    rootContainer: HostElement | string,
    isHydrate?: boolean
  ): ComponentPublicInstance
  unmount(rootContainer: HostElement | string): void
  provide<T>(key: InjectionKey<T> | string, value: T): this

  // internal. We need to expose these for the server-renderer and devtools
  _component: Component
  _props: Data | null
  _container: HostElement | null
  _context: AppContext
}

export type OptionMergeFunction = (
  to: unknown,
  from: unknown,
  instance: any,
  key: string
) => any

export interface AppConfig {
  // @private
  readonly isNativeTag?: (tag: string) => boolean

  devtools: boolean
  performance: boolean
  optionMergeStrategies: Record<string, OptionMergeFunction>
  globalProperties: Record<string, any>
  isCustomElement: (tag: string) => boolean
  errorHandler?: (
    err: unknown,
    instance: ComponentPublicInstance | null,
    info: string
  ) => void
  warnHandler?: (
    msg: string,
    instance: ComponentPublicInstance | null,
    trace: string
  ) => void
}

export interface AppContext {
  config: AppConfig
  mixins: ComponentOptions[]
  components: Record<string, PublicAPIComponent>
  directives: Record<string, Directive>
  provides: Record<string | symbol, any>
  reload?: () => void // HMR only

  // internal for devtools
  __app?: App
}

type PluginInstallFunction = (app: App, ...options: any[]) => any

export type Plugin =
  | PluginInstallFunction & { install?: PluginInstallFunction }
  | {
      install: PluginInstallFunction
    }
/**
 * 创建app上下文
 */
export function createAppContext(): AppContext {
  return {
    // devtools
    config: {
      isNativeTag: NO,
      devtools: true,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      isCustomElement: NO,
      errorHandler: undefined,
      warnHandler: undefined
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null)
  }
}

export type CreateAppFunction<HostElement> = (
  rootComponent: PublicAPIComponent,
  rootProps?: Data | null
) => App<HostElement>

/**
 * 创建app api
 * @param render 渲染器
 * @param hydrate 
 */
export function createAppAPI<HostElement>(
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
): CreateAppFunction<HostElement> {
 /**
  * 用来创建app的原始函数(首次初始化,根组件,没有根属性)
  * 1. 利用闭包将数据变量进行保存
  * @param {Object} 根组件
  * @Param 根属性
  */
  return function createApp(rootComponent, rootProps = null) {
    // 根属性!= null && 不是对象
    if (rootProps != null && !isObject(rootProps)) {
      // 
      __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }

    // 创建app的上下文对象,一直保存在闭包之中
    const context = createAppContext()

    // 值的集合不重复（不让插件重复安装
    const installedPlugins = new Set()

    // app没有被安装
    let isMounted = false

    // 创建的app对象
    const app: App = {
      _component: rootComponent as Component,
      _props: rootProps,
      _container: null,
      // app的上下文
      _context: context,

      version,

      get config() {
        // 获取app的配置
        return context.config
      },

      set config(v) {
        // app的配置不能被替换
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`
          )
        }
      },

      /**
       * 注册插件
       * @param plugin 
       * @param options 
       */
      use(plugin: Plugin, ...options: any[]) {
        if (installedPlugins.has(plugin)) {
          __DEV__ && warn(`Plugin has already been applied to target app.`)
        } else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin)
          plugin.install(app, ...options)
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin)
          plugin(app, ...options)
        } else if (__DEV__) {
          warn(
            `A plugin must either be a function or an object with an "install" ` +
              `function.`
          )
        }
        return app
      },

      /**
       * 混入
       * @param mixin 
       */
      mixin(mixin: ComponentOptions) {
        if (__FEATURE_OPTIONS__) {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
          } else if (__DEV__) {
            warn(
              'Mixin has already been applied to target app' +
                (mixin.name ? `: ${mixin.name}` : '')
            )
          }
        } else if (__DEV__) {
          warn('Mixins are only available in builds supporting Options API')
        }
        return app
      },

      /**
       * 注册或者搜索组件
       * @param name 组件名称
       * @param component 组件配置选项
       */
      component(name: string, component?: PublicAPIComponent): any {
        if (__DEV__) {
          validateComponentName(name, context.config)
        }
        // 没有配置
        if (!component) {
          // 获取应用实例中注册的组件
          return context.components[name]
        }
        // 注册的组件存在
        if (__DEV__ && context.components[name]) {
          // 组件已经被注册到了目标应用程序
          warn(`Component "${name}" has already been registered in target app.`)
        }
        // 给应用的components属性，注册组件
        context.components[name] = component
        return app
      },

      /**
       * 指令
       * @param name 名称
       * @param directive 指令 
       */
      directive(name: string, directive?: Directive) {
        if (__DEV__) {
          validateDirectiveName(name)
        }
        // 没有指令，返回指令容器中的指定，指令
        if (!directive) {
          return context.directives[name] as any
        }
        // 检查指令是否已经存在
        if (__DEV__ && context.directives[name]) {
          warn(`Directive "${name}" has already been registered in target app.`)
        }
        // 添加到指令容器中
        context.directives[name] = directive
        return app
      },
      /**
       * 真正的安装组件函数
       * @param rootContainer html中挂载节点
       * @param isHydrate 
       */
      mount(rootContainer: HostElement, isHydrate?: boolean): any {
        // 没有被安装
        if (!isMounted) {
          // 创建组件的vnode，跟组件的属性
          const vnode = createVNode(rootComponent as Component, rootProps)

          // 存储app上下文到根vnode
          // store app context on the root VNode.
          // 这个将在初始化安装时，被设置在根实例上
          // this will be set on the root instance on initial mount.
          vnode.appContext = context

          // HMR root reload
          if (__DEV__) {
            context.reload = () => {
              render(cloneVNode(vnode), rootContainer)
            }
          }

          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            // 渲染vnode到html
            render(vnode, rootContainer)
          }
          // app已被安装
          isMounted = true
          // 在app上添加_container属性作为 根挂载点的引用
          app._container = rootContainer
          // 初始化app, Vue的版本
          __DEV__ && initApp(app, version)
          // 
          return vnode.component!.proxy
        } else if (__DEV__) {
          // 已经被安装过了 
          warn(
            `App has already been mounted.\n` +
              `If you want to remount the same app, move your app creation logic ` +
              `into a factory function and create fresh app instances for each ` +
              `mount - e.g. \`const createMyApp = () => createApp(App)\``
          )
        }
      },

      /**
       * 卸载
       */
      unmount() {
        // 被安装了
        if (isMounted) {
          // vnode为空，说明组件为卸载操作
          render(null, app._container)
          // 
          __DEV__ && appUnmounted(app)
        } else if (__DEV__) {
          // 不能卸载一个没有安装的app
          warn(`Cannot unmount an app that is not mounted.`)
        }
      },

      /**
       * 注册提供器
       * @param key 
       * @param value 
       */
      provide(key, value) {
        if (__DEV__ && key in context.provides) {
          warn(
            `App already provides property with key "${String(key)}". ` +
              `It will be overwritten with the new value.`
          )
        }
        // TypeScript doesn't allow symbols as index type
        // https://github.com/Microsoft/TypeScript/issues/24587
        // 给app的提供器中添加依赖
        context.provides[key as string] = value

        return app
      }
    }
    // app实例添加__app属性
    context.__app = app

    return app
  }
}
