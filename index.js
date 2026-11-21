/**
 * Host-часть `dsh-cards`.
 *
 * Карточки в ответах — это markdown, но им нужны действия: «Запушить»,
 * «Скачать изменения» и тому подобное. Клиент не может запускать команды,
 * поэтому действия выполняет host по белому списку.
 *
 * Безопасность: выполняются только известные виды действий и только внутри
 * рабочей папки проекта. Произвольные команды запрещены.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const name = 'dsh-cards'
export const inject = ['connection']

const ACTION_PATH = '/api/dsh-cards/action'

/** Корни, внутри которых разрешено работать. */
const WORKSPACES = [
  'E:/DeepSeek Harness',
]

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** Путь внутри разрешённой рабочей папки. */
function insideWorkspace(target) {
  if (typeof target !== 'string' || target.trim() === '') return undefined
  const absolute = resolve(target)
  return WORKSPACES.some((root) => {
    const base = resolve(root)
    return absolute === base || absolute.startsWith(base + '\\') || absolute.startsWith(base + '/')
  })
    ? absolute
    : undefined
}

/** Путь к CLI DeepSeek Harness. */
function cliPath() {
  const candidates = [
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs/DeepSeek Harness/resources/runtime/cli/bin/dsh.cmd') : '',
    process.env.PROGRAMFILES ? join(process.env.PROGRAMFILES, 'DeepSeek Harness/resources/runtime/cli/bin/dsh.cmd') : '',
  ]
  return candidates.find((candidate) => candidate !== '' && existsSync(candidate))
}

/** Выполнить программу в каталоге (или без него). */
function gitInDir(cwd, program, args, timeout = 180_000) {
  return new Promise((resolveRun) => {
    const isScript = /\.(cmd|bat)$/i.test(program)
    const realProgram = isScript ? (process.env.ComSpec ?? 'cmd.exe') : program
    const realArgs = isScript ? ['/c', program, ...args] : args
    execFile(realProgram, realArgs, { cwd, timeout, windowsHide: true }, (error, stdout, stderr) => {
      resolveRun({ ok: error === null, output: `${String(stdout ?? '')}${String(stderr ?? '')}`.trim() })
    })
  })
}

/** Выполнить git в каталоге. */
function git(cwd, args, timeout = 60_000) {
  return new Promise((resolveRun) => {
    execFile('git', args, { cwd, timeout, windowsHide: true }, (error, stdout, stderr) => {
      const output = `${String(stdout ?? '')}${String(stderr ?? '')}`.trim()
      resolveRun({ ok: error === null, output })
    })
  })
}

export function apply(ctx) {
  try {
    ctx.effect(() => {
      ctx.connection.fetch.register({
        path: ACTION_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          let body = {}
          try {
            body = await request.json()
          } catch {
            body = {}
          }
          const kind = typeof body?.kind === 'string' ? body.kind : ''
          const target = insideWorkspace(body?.target)

          if (kind === 'git-push' || kind === 'git-pull') {
            if (target === undefined) return json({ ok: false, message: 'путь вне рабочей папки' })
            if (!existsSync(target)) return json({ ok: false, message: 'каталог не найден: ' + target })
            const args = kind === 'git-push' ? ['push', 'origin', 'HEAD:main'] : ['pull', '--rebase', 'origin', 'main']
            const result = await git(target, args)
            return json({
              ok: result.ok,
              message: result.ok
                ? kind === 'git-push' ? 'отправлено' : 'получено'
                : 'git ответил ошибкой',
              output: result.output.slice(-1200),
              target,
            })
          }

          if (kind === 'run-tests') {
            if (target === undefined) return json({ ok: false, message: 'путь вне рабочей папки' })
            if (!existsSync(target)) return json({ ok: false, message: 'каталог не найден: ' + target })
            const result = await gitInDir(target, process.execPath, ['--test'])
            return json({
              ok: result.ok,
              message: result.ok ? 'тесты прошли' : 'тесты нашли ошибки',
              output: result.output.slice(-1500),
              target,
            })
          }

          if (kind === 'dsh-plugin-add') {
            // target — спецификация установки, вид github:владелец/репозиторий.
            const spec = typeof body?.target === 'string' ? body.target.trim() : ''
            if (!/^github:mikhailnarzik-source\/[a-z0-9-]+$/i.test(spec)) {
              return json({ ok: false, message: 'ожидался github:mikhailnarzik-source/<репозиторий>' })
            }
            const cli = cliPath()
            if (cli === undefined) return json({ ok: false, message: 'CLI DeepSeek Harness не найден' })
            const result = await gitInDir(undefined, cli, ['plugin', '--profile', 'desktop', 'add', spec])
            return json({
              ok: result.ok,
              message: result.ok ? 'установлено — перезапусти DSH' : 'установка не удалась',
              output: result.output.slice(-1200),
            })
          }

          if (kind === 'open-folder') {
            if (target === undefined) return json({ ok: false, message: 'путь вне рабочей папки' })
            execFile('explorer', [target], { windowsHide: true }, () => {})
            return json({ ok: true, message: 'открыто', target })
          }

          return json({ ok: false, message: 'неизвестное действие: ' + kind })
        },
      })
    }, 'dsh-cards: action route')
  } catch (error) {
    console.error('[dsh-cards] маршрут действий недоступен:', error)
  }
}
