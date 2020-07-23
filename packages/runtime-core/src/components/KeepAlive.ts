import {
  Component,
  getCurrentInstance,
  FunctionalComponent,
  SetupContext,
  ComponentInternalInstance,
  LifecycleHooks,
  currentInstance
} from '../component'
import { VNode, cloneVNode, isVNode, VNodeProps } from '../vnode'
import { warn } from '../warning'
import {
  onBeforeUnmount,
  injectHook,
  onUnmounted,
  onBeforeMount,
  onBeforeUpdate
} from '../apiLifecycle'
import {
  isString,
  isArray,
  ShapeFlags,
  remove,
  invokeArrayFns
} from '@vue/shared'
import { watch } from '../apiWatch'
import {
  RendererInternals,
  queuePostRenderEffect,
  MoveType,
  RendererElement,
  RendererNode,
  invokeVNodeHook
} from '../renderer'
import { setTransitionHooks } from './BaseTransition'
import { ComponentRenderContext } from '../componentProxy'

type MatchPattern = string | RegExp | string[] | RegExp[]

export interface KeepAliveProps {
  include?: MatchPattern
  exclude?: MatchPattern
  max?: number | string
}

type CacheKey = string | number | Component
type Cache = Map<CacheKey, VNode>
type Keys = Set<CacheKey>

export interface KeepAliveContext extends ComponentRenderContext {
  renderer: RendererInternals
  activate: (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    isSVG: boolean,
    optimized: boolean
  ) => void
  deactivate: (vnode: VNode) => void
}

/**
 * 判断组件是否为keepAlive组件
 * 1. vnode的type属性存在 __isKeepAlive属性
 * @param vnode 
 */
export const isKeepAlive = (vnode: VNode): boolean =>
  (vnode.type as any).__isKeepAlive

const KeepAliveImpl = {
  name: `KeepAlive`,

  // Marker for special handling inside the renderer. We are not using a ===
  // check directly on KeepAlive in the renderer, because importing it directly
  // would prevent it from being tree-shaken.
  __isKeepAlive: true,

  inheritRef: true,

  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number]
  },

  setup(props: KeepAliveProps, { slots }: SetupContext) {
    // 缓存组件的vnode
    const cache: Cache = new Map()
    const keys: Keys = new Set()
    let current: VNode | null = null
    // 获取当前组件实例
    const instance = getCurrentInstance()!
    const parentSuspense = instance.suspense

    console.log(instance)

    // KeepAlive communicates with the instantiated renderer via the
    // ctx where the renderer passes in its internals,
    // and the KeepAlive instance exposes activate/deactivate implementations.
    // The whole point of this is to avoid importing KeepAlive directly in the
    // renderer to facilitate tree-shaking.
    // 这整个点是用来避免直接导入keepalive在渲染器中促进树摇
    const sharedContext = instance.ctx as KeepAliveContext
    const {
      renderer: {
        p: patch,
        m: move,
        um: _unmount,
        o: { createElement }
      }
    } = sharedContext
    const storageContainer = createElement('div')

    sharedContext.activate = (vnode, container, anchor, isSVG, optimized) => {
      const instance = vnode.component!
      move(vnode, container, anchor, MoveType.ENTER, parentSuspense)
      // in case props have changed
      patch(
        instance.vnode,
        vnode,
        container,
        anchor,
        instance,
        parentSuspense,
        isSVG,
        optimized
      )
      queuePostRenderEffect(() => {
        instance.isDeactivated = false
        if (instance.a) {
          invokeArrayFns(instance.a)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeMounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
      }, parentSuspense)
    }

    sharedContext.deactivate = (vnode: VNode) => {
      const instance = vnode.component!
      move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)
      queuePostRenderEffect(() => {
        if (instance.da) {
          invokeArrayFns(instance.da)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
        instance.isDeactivated = true
      }, parentSuspense)
    }

    function unmount(vnode: VNode) {
      // reset the shapeFlag so it can be properly unmounted
      resetShapeFlag(vnode)
      _unmount(vnode, instance, parentSuspense)
    }

    /**
     * 修剪缓存
     * @param filter 过滤函数
     */
    function pruneCache(filter?: (name: string) => boolean) {
      cache.forEach((vnode, key) => {
        // 获取vnode的type对象，并获取他的name,组件类型
        const name = getName(vnode.type as Component)
        // 组件存在 && 没有过滤函数 || 过滤中找不到
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key)
        }
      })
    }

    /**
     * 修建缓存
     * @param key 
     */
    function pruneCacheEntry(key: CacheKey) {
      // 从缓存中根据组件的key获取vnode
      const cached = cache.get(key) as VNode
      // 当前不存在 || 缓存中的vnode和当前的不等
      if (!current || cached.type !== current.type) {
        // 卸载
        unmount(cached)
        // 当前存在
      } else if (current) {
        // current active instance should no longer be kept-alive.
        // we can't unmount it now but it might be later, so reset its flag now.
        resetShapeFlag(current)
      }
      // 删除缓存
      cache.delete(key)
      keys.delete(key)
    }

    watch(
      // 监听属性变化
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => matches(exclude, name))
      }
    )

    // cache sub tree in beforeMount/Update (i.e. right after the render)
    let pendingCacheKey: CacheKey | null = null
    const cacheSubtree = () => {
      // fix #1621, the pendingCacheKey could be 0
      // 等候缓存key != null
      if (pendingCacheKey != null) {
        // 进行缓存
        cache.set(pendingCacheKey, instance.subTree)
      }
    }
    // 安装前
    onBeforeMount(cacheSubtree)
    onBeforeUpdate(cacheSubtree)

    onBeforeUnmount(() => {
      cache.forEach(cached => {
        const { subTree, suspense } = instance
        if (cached.type === subTree.type) {
          // current instance will be unmounted as part of keep-alive's unmount
          resetShapeFlag(subTree)
          // but invoke its deactivated hook here
          const da = subTree.component!.da
          da && queuePostRenderEffect(da, suspense)
          return
        }
        unmount(cached)
      })
    })
    
    // created之前执行
    return () => {
      // 1. 清空当前缓存key变量
      pendingCacheKey = null
      // 2. 判断有插槽中没有数据
      if (!slots.default) {
        return null
      }
      // 3. 获取默认插槽中的组件vnode
      const children = slots.default()
      // 4. 获取第一个虚拟节点
      let vnode = children[0]
      // 5. 子组件的数量》1
      if (children.length > 1) {
        // 警告组件中只能有一个组件
        if (__DEV__) {
          // keepAlive应该只包含一个子组件
          warn(`KeepAlive should contain exactly one component child.`)
        }
        // 清除当前组件实例
        current = null
        return children
      } else if (
        // 不是vnode节点
        !isVNode(vnode) ||
        // vnode的类型的标识不存在 || 不是有状态组件
        !(vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT)
      ) {
        current = null
        return vnode
      }

      // vnode的类型 强转为组件
      const comp = vnode.type as Component
      // 获取组件名称 displayName name
      const name = getName(comp)

      // 这个是<keep-alive :include="a,b,c" :exclude="" :max="1"></keep-alive>
      // 匹配到的组件，可以保活， 
      const { include, exclude, max } = props

      if (
        // 包括属性 && 组件明不存在 || 在include中是否包含此组件
        (include && (!name || !matches(include, name))) ||
        // 排除组件 && 组件存在 && 在排除中匹配到
        (exclude && name && matches(exclude, name))
      ) {
        return (current = vnode)
      }

      // vnode的key==null用组件名称，否则用key
      const key = vnode.key == null ? comp : vnode.key

      // 获取是否存在这个vnode
      const cachedVNode = cache.get(key)

      // clone vnode if it's reused because we are going to mutate it
      // 因为我们打算改变它重复使用， 
      if (vnode.el) {
        vnode = cloneVNode(vnode)
      }
      // #1513 it's possible for the returned vnode to be cloned due to attr
      // fallthrough or scopeId, so the vnode here may not be the final vnode
      // that is mounted. Instead of caching it directly, we store the pending
      // key and cache `instance.subTree` (the normalized vnode) in
      // beforeMount/beforeUpdate hooks.
      // 设置缓存的key
      pendingCacheKey = key

      if (cachedVNode) {
        // copy over mounted state
        // 复制挂载状态
        vnode.el = cachedVNode.el
        vnode.component = cachedVNode.component
        if (vnode.transition) {
          // recursively update transition hooks on subTree
          setTransitionHooks(vnode, vnode.transition!)
        }
        // avoid vnode being mounted as fresh
        // 避免vnode被装新
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE
        // make this key the freshest
        keys.delete(key)
        keys.add(key)
      } else {
        // 不存在就添加，如果缓存数量已经大于限定的max，将最近，最少访问的删除
        keys.add(key)
        // prune oldest entry 修剪最老的节点
        if (max && keys.size > parseInt(max as string, 10)) {
          pruneCacheEntry(keys.values().next().value)
        }
      }
      // avoid vnode being unmounted
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE

      current = vnode
      // h()
      return vnode
    }
  }
}

// 暴露这个公共类型给tsx接口
// export the public type for h/tsx inference
// 还避免了在生成的d.ts文件中内联import()
// also to avoid inline import() in generated d.ts files
export const KeepAlive = (KeepAliveImpl as any) as {
  new (): {
    $props: VNodeProps & KeepAliveProps
  }
}

function getName(comp: Component): string | void {
  return (comp as FunctionalComponent).displayName || comp.name
}

/**
 * 匹配
 * @param pattern 模式
 * @param name 项目
 */
function matches(pattern: MatchPattern, name: string): boolean {
  // 模式是数组类型
  if (isArray(pattern)) {
    // 判断模式数组中每个元素与name是否匹配
    return pattern.some((p: string | RegExp) => matches(p, name))
    // 模式是字符串类型
  } else if (isString(pattern)) {
    // 将字符串以逗号分割，在里面找匹配的到的
    return pattern.split(',').indexOf(name) > -1
    // 模式有test方法（说明是正则对象）
  } else if (pattern.test) {
    // 直接匹配
    return pattern.test(name)
  }
  /* istanbul ignore next */
  // 数据不对
  return false
}

export function onActivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.ACTIVATED, target)
}

export function onDeactivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.DEACTIVATED, target)
}

function registerKeepAliveHook(
  hook: Function & { __wdc?: Function },
  type: LifecycleHooks,
  target: ComponentInternalInstance | null = currentInstance
) {
  // cache the deactivate branch check wrapper for injected hooks so the same
  // hook can be properly deduped by the scheduler. "__wdc" stands for "with
  // deactivation check".
  const wrappedHook =
    hook.__wdc ||
    (hook.__wdc = () => {
      // only fire the hook if the target instance is NOT in a deactivated branch.
      let current: ComponentInternalInstance | null = target
      while (current) {
        if (current.isDeactivated) {
          return
        }
        current = current.parent
      }
      hook()
    })
  injectHook(type, wrappedHook, target)
  // In addition to registering it on the target instance, we walk up the parent
  // chain and register it on all ancestor instances that are keep-alive roots.
  // This avoids the need to walk the entire component tree when invoking these
  // hooks, and more importantly, avoids the need to track child components in
  // arrays.
  if (target) {
    let current = target.parent
    while (current && current.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        injectToKeepAliveRoot(wrappedHook, type, target, current)
      }
      current = current.parent
    }
  }
}

function injectToKeepAliveRoot(
  hook: Function,
  type: LifecycleHooks,
  target: ComponentInternalInstance,
  keepAliveRoot: ComponentInternalInstance
) {
  injectHook(type, hook, keepAliveRoot, true /* prepend */)
  onUnmounted(() => {
    remove(keepAliveRoot[type]!, hook)
  }, target)
}

function resetShapeFlag(vnode: VNode) {
  let shapeFlag = vnode.shapeFlag
  if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
    shapeFlag -= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
  }
  if (shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
    shapeFlag -= ShapeFlags.COMPONENT_KEPT_ALIVE
  }
  vnode.shapeFlag = shapeFlag
}
