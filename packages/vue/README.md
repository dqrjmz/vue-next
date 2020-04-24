# vue

## 使用哪个dist文件?
## Which dist file to use?

### 从cdn或者不带捆绑器
### From CDN or without a Bundler

- **`vue(.runtime).global(.prod).js`**:
  - 在浏览器中直接通过使用`<script src="...">`,暴露`Vue`全局对象
  - For direct use via `<script src="...">` in the browser. Exposes the `Vue` global.
  - 注意全局构建不是[UMD](https://github.com/umdjs/umd)构建,他们被用作[IIFEs](https://developer.mozilla.org/en-US/docs/Glossary/IIF)而且只可以直接通过`<script src="...">`来使用
  - Note that global builds are not [UMD](https://github.com/umdjs/umd) builds.  They are built as [IIFEs](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) and is only meant for direct use via `<script src="...">`.
  - 浏览器内的模板编译
  - In-browser template compilation:
    - **`vue.global.js`** 是包含编译器运行时的全部构建,所以它支持在运行的时候进行模板编译
    - **`vue.global.js`** is the "full" build that includes both the compiler and the runtime so it supports compiling templates on the fly.
    - **`vue.runtime.global.js`** 之包含运行时,并且需要模板在构建步骤被预编译
    - **`vue.runtime.global.js`** contains only the runtime and requires templates to be pre-compiled during a build step.
  - 内联全部Vue核心的内部包,例如 他是一个不依赖其他文件的单独文件,这意味着你从这个文件导入任何事情,并且这个文件只能确保你得到代码中相同的实例
  - Inlines all Vue core internal packages - i.e. it's a single file with no dependencies on other files. This means you **must** import everything from this file and this file only to ensure you are getting the same instance of code.
  - 包含硬编码的prod/dev分支, 以及生产构建是预缩的,在生产中使用`*.prod.js`文件
  - Contains hard-coded prod/dev branches, and the prod build is pre-minified. Use the `*.prod.js` files for production.

- **`vue(.runtime).esm-browser(.prod).js`**:
  - 通过使用原生的es模块来导入(在浏览器中使用`<script type="module">`
  - For usage via native ES modules imports (in browser via `<script type="module">`.
  - 共享相同的运行时编译,使用全局的构建依赖内联的和硬编码的prod/dev行为
  - Shares the same runtime compilation, dependency inlining and hard-coded prod/dev behavior with the global build.

### 使用一个打包器
### With a Bundler

- **`vue(.runtime).esm-bundler.js`**:

  - 使用像`webpack`, `rollup`, `parcel`的打包器
  - For use with bundlers like `webpack`, `rollup` and `parcel`.
  - 使用`process.env.NODE_ENV`警卫,切换prod/dev场景(必须使用打包器来替换)
  - Leaves prod/dev branches with `process.env.NODE_ENV` guards (must be replaced by bundler)
  - 不发布缩小版本(打包后和其余代码一起完成)
  - Does not ship minified builds (to be done together with the rest of the code after bundling)
  - 导入依赖(例如:`@vue/runtime-core`, `@vue/runtime-compiler`)
  - Imports dependencies (e.g. `@vue/runtime-core`, `@vue/runtime-compiler`)
    - 依赖被导入`esm-bundler`构建,并且将导入他们的依赖(例如:`@vue/runtime-core` 导入 `@vue/reactivity`)
    - Imported dependencies are also `esm-bundler` builds and will in turn import their dependencies (e.g. `@vue/runtime-core` imports `@vue/reactivity`)
    - 这意味这你能独立的安装/导入这写依赖不涉及这些依赖的不同实例,但是你必须确保,他们所有解析这个是在同一个版本
    - This means you **can** install/import these deps individually without ending up with different instances of these dependencies, but you must make sure they all resolve to the same version.
  - 浏览器内的模板编译
  - In-browser template compilation:
    - **`vue.runtime.esm-bundler.js` (default)** 只是一个运行时,并且所有模板都需要预编译,这个是打包器的默认入口(通过package.json中的`module`字段),当使用一个打包器模板是经典的预编译(例如:在`*.vue`文件中)
    - **`vue.runtime.esm-bundler.js` (default)** is runtime only, and requires all templates to be pre-compiled. This is the default entry for bundlers (via `module` field in 
    `package.json`) because when using a bundler templates are typically pre-compiled (e.g. in `*.vue` files).
    - **`vue.esm-bundler.js`**: 包括运行时编译,如果你正在使用一个打包器但是仍然想要运行时模板编译就使用这个(例如:在dom模板,或者通过js字符串内联的),你将需要通过配置你的打包器,在 `vue`这个文件的别名
    - **`vue.esm-bundler.js`**: includes the runtime compiler. Use this if you are using a bundler but still want runtime template compilation (e.g. in-DOM templates or templates via inline JavaScript strings). You will need to configure your bundler to alias `vue` to this file.

### 服务器端渲染
### For Server-Side Rendering

- **`vue.cjs(.prod).js`**:
- **`vue.cjs(.prod).js`**:
  - 通过`require()`在nodejs的服务器端渲染中使用
  - For use in Node.js server-side rendering via `require()`.
  - 如果你使用webpack设置`target: 'node'`打包你的appm,可能拓展vue,这个在构建的时候被加载
  - If you bundle your app with webpack with `target: 'node'` and properly externalize `vue`, this is the build that will be loaded.
  - dev/prod文件别预编译,基于`process.env.NODE_ENV`合适的文件被自动导入
  - The dev/prod files are pre-built, but the appropriate file is automatically required based on `process.env.NODE_ENV`.
