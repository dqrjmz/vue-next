const fs = require('fs')
const chalk = require('chalk')

/**
 * packages下是否为 不为私有的和有构建模块格式的
 */
const targets = (exports.targets = fs.readdirSync('packages').filter(f => {
  // packages下的路径不是目录
  if (!fs.statSync(`packages/${f}`).isDirectory()) {
    return false
  }
  // 获取 package json
  const pkg = require(`../packages/${f}/package.json`)
  if (pkg.private && !pkg.buildOptions) {
    return false
  }
  return true
}))

exports.fuzzyMatchTarget = (partialTargets, includeAllMatching) => {
  const matched = []
  partialTargets.forEach(partialTarget => {
    for (const target of targets) {
      if (target.match(partialTarget)) {
        matched.push(target)
        if (!includeAllMatching) {
          break
        }
      }
    }
  })
  if (matched.length) {
    return matched
  } else {
    console.log()
    console.error(
      `  ${chalk.bgRed.white(' ERROR ')} ${chalk.red(
        `Target ${chalk.underline(partialTargets)} not found!`
      )}`
    )
    console.log()

    process.exit(1)
  }
}
