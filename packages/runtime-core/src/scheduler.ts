import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { isArray } from '@vue/shared'

// 工作实例类型
export interface Job {
  (): void
  id?: number
}

// 队列
const queue: (Job | null)[] = []
// 
const postFlushCbs: Function[] = []
// resloved的Promise对象
const p = Promise.resolve()

// 没有被刷新
let isFlushing = false
// 没有刷新等待中
let isFlushPending = false
// 递归限制深度
const RECURSION_LIMIT = 100
type CountMap = Map<Job | Function, number>

// 异步执行回调
export function nextTick(fn?: () => void): Promise<void> {
  return fn ? p.then(fn) : p
}

// 队列工作
export function queueJob(job: Job) {
  // 队列中不包含此工作
  if (!queue.includes(job)) {
    // 添加到队列
    queue.push(job)
    // 刷新队列
    queueFlush()
  }
}

/**
 * 无效工作
 * @param job 被无效的工作
 */
export function invalidateJob(job: Job) {
  // 当前队列是否存在这个工作
  const i = queue.indexOf(job)
  if (i > -1) {
    // 工作置为 null
    queue[i] = null
  }
}

export function queuePostFlushCb(cb: Function | Function[]) {
  // 回调不是数组
  if (!isArray(cb)) {
    // 直接添加到回调刷新队列
    postFlushCbs.push(cb)
  } else {
    // 数组，展开后添加
    postFlushCbs.push(...cb)
  }
  // 刷新队列
  queueFlush()
}

function queueFlush() {
  // 开始刷新
  if (!isFlushing && !isFlushPending) {
    // 等待刷新
    isFlushPending = true
    // 执行刷新工作
    nextTick(flushJobs)
  }
}

export function flushPostFlushCbs(seen?: CountMap) {
  // 刷新回调的数组不为空
  if (postFlushCbs.length) {
    // 去重，展开
    const cbs = [...new Set(postFlushCbs)]
    // 设置数组为空
    postFlushCbs.length = 0
    // 开发中
    if (__DEV__) {
      // 创建哈希表
      seen = seen || new Map()
    }
    // 遍历回调
    for (let i = 0; i < cbs.length; i++) {
      // 开发中
      if (__DEV__) {
        // 查看递归更新
        checkRecursiveUpdates(seen!, cbs[i])
      }
      // 调用回调
      cbs[i]()
    }
  }
}

// 工作id不为空返回，为空返回无限数值，全局属性（Infinity）
const getId = (job: Job) => (job.id == null ? Infinity : job.id)

function flushJobs(seen?: CountMap) {
  // 不等待刷新
  isFlushPending = false
  // 正在刷新中
  isFlushing = true
  let job
  if (__DEV__) {
    seen = seen || new Map()
  }

  // 刷新前排序队列
  // Sort queue before flush.
  // 确保
  // This ensures that:
  // 1. 从父组件到子组件被更新（因为父总是被创建在子之前，所以它的渲染影响将更小）
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child so its render effect will have smaller
  //    priority number)
  // 2. 如果父组件更新期间，一个组件被卸载，它的更新将被跳过
  // 2. If a component is unmounted during a parent component's update,
  //    its update can be skipped.
  // 工作在刷新开始之前，不能为null,所以另一个执行刷新工作期间，他们被验证
  // Jobs can never be null before flush starts, since they are only invalidated
  // during execution of another flushed job.
  queue.sort((a, b) => getId(a!) - getId(b!))

  // 开始出队列
  while ((job = queue.shift()) !== undefined) {
    // 工作为null，直接返回
    if (job === null) {
      continue
    }
    // 开发中
    if (__DEV__) {
      // 检查递归更新
      checkRecursiveUpdates(seen!, job)
    }
    // 使用错误处理
    callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
  }
  // 刷新
  flushPostFlushCbs(seen)
  // 没有刷新
  isFlushing = false
  // some postFlushCb queued jobs!
  // keep flushing until it drains.
  // 
  if (queue.length || postFlushCbs.length) {
    flushJobs(seen)
  }
}

function checkRecursiveUpdates(seen: CountMap, fn: Job | Function) {
  // 不能存在就添加
  if (!seen.has(fn)) {
    seen.set(fn, 1)
  } else {
    // 存在就获取
    const count = seen.get(fn)!
    // 调用栈大于100 爆栈
    if (count > RECURSION_LIMIT) {
      throw new Error(
        'Maximum recursive updates exceeded. ' +
          "You may have code that is mutating state in your component's " +
          'render function or updated hook or watcher source function.'
      )
    } else {
      // 每次加1
      seen.set(fn, count + 1)
    }
  }
}
