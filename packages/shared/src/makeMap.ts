/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * IMPORTANT: all calls of this function must be prefixed with
 * \/\*#\_\_PURE\_\_\*\/
 * So that rollup can tree-shake them if necessary.
 */
export function makeMap(
  str: string,
  expectsLowerCase?: boolean
): (key: string) => boolean {
  // 创建一个__proto__属性为null的对象
  const map: Record<string, boolean> = Object.create(null)
  // 将字符串以","分割为数组
  const list: Array<string> = str.split(',')
  // 将元素添加到map中key设置为元素值,value设置为true
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  // 接收小写? 将map的key先转为小写 : 直接返回
  return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val]
}
