export const enum ShapeFlags {
  // 元素
  ELEMENT = 1,
  // 函数组件
  FUNCTIONAL_COMPONENT = 1 << 1, // 2
  // 无状态组件
  STATEFUL_COMPONENT = 1 << 2, // 4
  // 子文本
  TEXT_CHILDREN = 1 << 3, // 8
  // 子数组
  ARRAY_CHILDREN = 1 << 4, // 16
  // 子插槽
  SLOTS_CHILDREN = 1 << 5, // 32
  // 模板
  TELEPORT = 1 << 6,  // 64
  // 
  SUSPENSE = 1 << 7, // 128
  // keep-alive
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // 256
  // 
  COMPONENT_KEPT_ALIVE = 1 << 9, // 512
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
}
