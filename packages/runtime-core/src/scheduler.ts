import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { isArray } from '@vue/shared'

// 工作实例类型
export interface Job {
  (): void
  id?: number
}

// 队列
const queue: (Job | null)[] = []
// 需要刷新的回调函数
const postFlushCbs: Function[] = []
// 成功状态的Promise对象
const p = Promise.resolve()

// 是否开始被刷新
let isFlushing = false
// 是否在刷新中
let isFlushPending = false
let flushIndex = 0
let pendingPostFlushCbs: Function[] | null = null
let pendingPostFlushIndex = 0
// 递归限制100
const RECURSION_LIMIT = 100
type CountMap = Map<Job | Function, number>

/**
 * 异步执行回调
 * @param fn 回调函数
 * @returns Promise实例
 */
export function nextTick(fn?: () => void): Promise<void> {
  // 是函数直接放到promise的then中， 不是直接返回
  return fn ? p.then(fn) : p
}

/**
 * 队列任务
 * @param job 任务
 */
export function queueJob(job: Job) {
  // 队列中不存在这个任务
  if (!queue.includes(job, flushIndex)) {
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

/**
 * 队列刷新回调
 * @param cb 
 */
export function queuePostFlushCb(cb: Function | Function[]) {
  // 回调不是数组
  if (!isArray(cb)) {
    if (
      !pendingPostFlushCbs ||
      !pendingPostFlushCbs.includes(cb, pendingPostFlushIndex)
    ) {
      postFlushCbs.push(cb)
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip dupicate check here to improve perf
    postFlushCbs.push(...cb)
  }
  // 刷新队列
  queueFlush()
}

/**
 * 刷新队列
 */
function queueFlush() {
  // 没有正在刷新 && 没有刷新等待 =》 开始刷新
  if (!isFlushing && !isFlushPending) {
    // 等待刷新
    isFlushPending = true
    // 执行刷新工作
    nextTick(flushJobs)
  }
}

/**
 * 
 * @param seen 
 */
export function flushPostFlushCbs(seen?: CountMap) {
  // 刷新回调的数组不为空
  if (postFlushCbs.length) {
    pendingPostFlushCbs = [...new Set(postFlushCbs)]
    // 设置数组为空
    postFlushCbs.length = 0
    // 开发中
    if (__DEV__) {
      // 创建哈希表
      seen = seen || new Map()
    }
    for (
      pendingPostFlushIndex = 0;
      pendingPostFlushIndex < pendingPostFlushCbs.length;
      pendingPostFlushIndex++
    ) {
      if (__DEV__) {
        checkRecursiveUpdates(seen!, pendingPostFlushCbs[pendingPostFlushIndex])
      }
      pendingPostFlushCbs[pendingPostFlushIndex]()
    }
    pendingPostFlushCbs = null
    pendingPostFlushIndex = 0
  }
}

// 工作id不为空返回，为空返回无限数值，全局属性（Infinity）
const getId = (job: Job) => (job.id == null ? Infinity : job.id)

/**
 * 刷新任务函数
 * @param seen 
 */
function flushJobs(seen?: CountMap) {
  // 开始刷新，不用再等待了
  isFlushPending = false
  // 正在刷新中
  isFlushing = true
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

  // 给任务队列排序 根据id,从大到小
  queue.sort((a, b) => getId(a!) - getId(b!))

  // 遍历任务队列
  for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
    // 获取当前任务
    const job = queue[flushIndex]
    // 任务存在
    if (job) {
      // 开发中
      if (__DEV__) {
        // 检查递归更新
        checkRecursiveUpdates(seen!, job)
      }
      // 使用错误处理函数进行调用
      callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
    }
  }
  // 执行完任务，清空队列
  flushIndex = 0
  queue.length = 0

  flushPostFlushCbs(seen)
  // 刷新完成
  isFlushing = false
  // some postFlushCb queued jobs!
  // keep flushing until it drains. 
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
