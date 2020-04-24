// Invoked on the commit-msg git hook by yorkie.

// 终端命令行的样式
const chalk = require('chalk')
// 进程中的环境变量
const msgPath = process.env.GIT_PARAMS
// 文件模块
const msg = require('fs')
  // 同步读取文件,使用utf-8编码方式
  .readFileSync(msgPath, 'utf-8')
  // 去掉空格
  .trim()

const commitRE = /^(revert: )?(feat|fix|docs|dx|style|refactor|perf|test|workflow|build|ci|chore|types|wip|release)(\(.+\))?: .{1,50}/

// commit信息不是指定的格式
if (!commitRE.test(msg)) {
  // 报错提示
  console.error(
    `  ${chalk.bgRed.white(' ERROR ')} ${chalk.red(
      `invalid commit message format.`
    )}\n\n` +
      chalk.red(
        `  Proper commit message format is required for automated changelog generation. Examples:\n\n`
      ) +
      `    ${chalk.green(`feat(compiler): add 'comments' option`)}\n` +
      `    ${chalk.green(
        `fix(v-model): handle events on blur (close #28)`
      )}\n\n` +
      chalk.red(`  See .github/commit-convention.md for more details.\n`)
  )
  // 退出进程
  process.exit(1)
}
