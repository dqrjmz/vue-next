/*
Run Rollup in watch mode for development.

To specific the package to watch, simply pass its name and the desired build
formats to watch (defaults to "global"):

```
# name supports fuzzy match. will watch all packages with name containing "dom"
yarn dev dom

# specify the format to output
yarn dev core --formats cjs

# Can also drop all __DEV__ blocks with:
__DEV__=false yarn dev
```
*/

// 执行全局npm命令的模块  Process execution for humans(人为的进程执行)
const execa = require('execa')
const { fuzzyMatchTarget } = require('./utils')
// 解析参数选项
const args = require('minimist')(process.argv.slice(2))
// 获取进程参数长度
const target = args._.length ? fuzzyMatchTarget(args._)[0] : 'vue'
// 获取打包的模块格式
const formats = args.formats || args.f
// 源码视图
const sourceMap = args.sourcemap || args.s
// 获取git提交记录
const commit = execa.sync('git', ['rev-parse', 'HEAD']).stdout.slice(0, 7)

// 执行命令行
execa(
  'rollup',
  [
    '-wc',
    '--environment',
    [
      `COMMIT:${commit}`,
      `TARGET:${target}`,
      `FORMATS:${formats || 'global'}`,
      sourceMap ? `SOURCE_MAP:true` : ``
    ]
      .filter(Boolean)
      .join(',')
  ],
  {
    stdio: 'inherit'
  }
)
