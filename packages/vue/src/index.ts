// This entry is the "full-build" that includes both the runtime
// and the compiler, and supports on-the-fly compilation of the template option.
import { initDev } from './dev'
import { compile, CompilerOptions, CompilerError } from '@vue/compiler-dom'
import { registerRuntimeCompiler, RenderFunction, warn } from '@vue/runtime-dom'
import * as runtimeDom from '@vue/runtime-dom'
import { isString, NOOP, generateCodeFrame, extend } from '@vue/shared'
import { InternalRenderFunction } from 'packages/runtime-core/src/component'

__DEV__ && initDev()

const compileCache: Record<string, RenderFunction> = Object.create(null)

function compileToFunction(
  template: string | HTMLElement,
  options?: CompilerOptions
): RenderFunction {
  // 模板不是字符串
  if (!isString(template)) {
    // 节点类型(节点的值都是真值)
    if (template.nodeType) {
      // 节点中的html
      template = template.innerHTML
    } else {
      __DEV__ && warn(`invalid template option: `, template)
      return NOOP
    }
  }

  // 字符串
  const key = template
  // 编译缓存(编译过程漫长),将模板当作key,哈希
  const cached = compileCache[key]
  // 有缓存直接返回
  if (cached) {
    return cached
  }
  // 模板第一个字符是#,说明是选择符
  if (template[0] === '#') {
    // 获取这个dom节点
    const el = document.querySelector(template)
    // 开发环境中,元素不能存在
    if (__DEV__ && !el) {
      warn(`Template element not found or is empty: ${template}`)
    }
    // __UNSAFE__
    // Reason: potential execution of JS expressions in in-DOM template.
    // The user must make sure the in-DOM template is trusted. If it's rendered
    // by the server, the template should not contain any user data.
    // dom节点存在,获取dom中的html
    template = el ? el.innerHTML : ``
  }

  const { code } = compile(
    template,
    extend(
      {
        hoistStatic: true,
    // 模板编译错误回调
        onError(err: CompilerError) {
      // 开发中...
          if (__DEV__) {
        //  提示信息
            const message = `Template compilation error: ${err.message}`
            const codeFrame =
              err.loc &&
              generateCodeFrame(
                template as string,
                err.loc.start.offset,
                err.loc.end.offset
              )
            warn(codeFrame ? `${message}\n${codeFrame}` : message)
          } else {
            /* istanbul ignore next */
            throw err
          }
        }
      },
      options
    )
  )

  // The wildcard import results in a huge object with every export
  // with keys that cannot be mangled, and can be quite heavy size-wise.
  // In the global build we know `Vue` is available globally so we can avoid
  // the wildcard object.
  const render = (__GLOBAL__
    ? new Function(code)()
    : new Function('Vue', code)(runtimeDom)) as RenderFunction

  // mark the function as runtime compiled
  ;(render as InternalRenderFunction)._rc = true

  return (compileCache[key] = render)
}

registerRuntimeCompiler(compileToFunction)

export { compileToFunction as compile }
export * from '@vue/runtime-dom'
