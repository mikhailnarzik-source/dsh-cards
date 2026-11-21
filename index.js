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
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export const name = 'dsh-cards'
export const inject = ['connection']

const ACTION_PATH = '/api/dsh-cards/action'

/** Корни, внутри которых разрешено работать. */
const WORKSPACES = [
  'E:/DeepSeek Harness',
]

/** Каталоги, которые можно открыть в проводнике (только просмотр). */
const OPEN_ROOTS = [
  'E:/DeepSeek Harness',
  'C:/Users/Narzik/.dsh',
  'C:/Users/Narzik/Documents',
  'C:/Users/Narzik/Desktop',
  'C:/Users/Narzik/Downloads',
]

/** Путь внутри одного из разрешённых каталогов просмотра. */
function insideOpenRoots(target) {
  if (typeof target !== 'string' || target.trim() === '') return undefined
  const absolute = resolve(target)
  return OPEN_ROOTS.some((root) => {
    const base = resolve(root)
    return absolute === base || absolute.startsWith(base + '\\') || absolute.startsWith(base + '/')
  })
    ? absolute
    : undefined
}

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

/** Известные редакторы: id → команда и человеческое имя. */
const EDITORS = [
  { id: 'vscode', name: 'VS Code', command: 'code', exe: 'code.exe' },
  { id: 'cursor', name: 'Cursor', command: 'cursor', exe: 'cursor.exe' },
  { id: 'sublime', name: 'Sublime Text', command: 'subl', exe: 'subl.exe' },
  { id: 'notepadpp', name: 'Notepad++', command: 'notepad++', exe: 'notepad++.exe' },
  { id: 'notepad', name: 'Блокнот', command: 'notepad', exe: 'notepad.exe' },
]

/** Установлен ли редактор. */
function editorAvailable(command) {
  return new Promise((resolveAvailable) => {
    execFile(process.env.ComSpec ?? 'cmd.exe', ['/c', 'where', command], { windowsHide: true, timeout: 8000 }, (error) => {
      resolveAvailable(error === null)
    })
  })
}

/** Список установленных редакторов. */
async function detectEditors() {
  const found = []
  for (const editor of EDITORS) {
    if (await editorAvailable(editor.command)) found.push({ id: editor.id, name: editor.name })
  }
  return found
}

/** Открыть файл в найденном редакторе; запасной вариант — блокнот. */


/** Открыть файл в редакторе: конкретном или первом найденном. */
function openInEditor(filePath, requested) {
  return new Promise((resolveEditor) => {
    let candidates = EDITORS.map((editor) => ({ ...editor }))
    if (typeof requested === 'string' && requested !== '' && requested !== 'auto') {
      const wanted = candidates.filter((editor) => editor.id === requested)
      if (wanted.length === 0) {
        resolveEditor({ ok: false, editor: '', message: 'неизвестный редактор: ' + requested })
        return
      }
      candidates = wanted
    }

    /** Запуск через cmd: работает и для .exe, и для .cmd-обёрток. */
    const launch = (editor, done) => {
      const viaCmd = () => {
        execFile(process.env.ComSpec ?? 'cmd.exe', ['/c', editor.command, filePath], { windowsHide: true, timeout: 25_000 }, (error) => {
          if (error === null) { done(true); return }
          const viaExe = () => {
            execFile(editor.exe, [filePath], { windowsHide: false, timeout: 25_000 }, (exeError) => done(exeError === null))
          }
          viaExe()
        })
      }
      viaCmd()
    }

    const tryNext = (index) => {
      if (index >= candidates.length) {
        resolveEditor({ ok: false, editor: '', message: 'не удалось открыть: редакторы не отвечают' })
        return
      }
      launch(candidates[index], (ok) => {
        if (ok) { resolveEditor({ ok: true, editor: candidates[index].name }); return }
        tryNext(index + 1)
      })
    }
    tryNext(0)
  })
}

/** Показать диалог «Сохранить как» и скопировать файл по выбранному пути. */
function openSaveDialog(sourcePath) {
  const escaped = sourcePath.replace(/'/g, "''")
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms | Out-Null',
    '$dialog = New-Object System.Windows.Forms.SaveFileDialog',
    "$dialog.Title = 'Сохранить файл'",
    '$dialog.FileName = Split-Path -Leaf \'' + escaped + '\'',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  Copy-Item -LiteralPath \'' + escaped + '\' -Destination $dialog.FileName -Force',
    '}',
  ].join(String.fromCharCode(10))
  try {
    execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: false, timeout: 120_000 }, () => {})
    return true
  } catch {
    return false
  }
}

/** Положить текст в буфер обмена Windows. */
function copyToClipboard(text) {
  return new Promise((resolveCopy) => {
    try {
      const script = 'Set-Clipboard -Value ([Console]::In.ReadToEnd())'
      const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15_000 }, (error) => {
        resolveCopy(error === null)
      })
      if (child.stdin !== null) {
        child.stdin.write(text, 'utf8')
        child.stdin.end()
      }
    } catch {
      resolveCopy(false)
    }
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

          if (kind === 'dsh-plugin-update') {
            // target — спецификация установки, plugin — имя пакета для удаления.
            const spec = typeof body?.target === 'string' ? body.target.trim() : ''
            const packageName = typeof body?.plugin === 'string' ? body.plugin.trim() : ''
            if (!/^github:mikhailnarzik-source\/[a-z0-9-]+$/i.test(spec)) {
              return json({ ok: false, message: 'ожидался github:mikhailnarzik-source/<репозиторий>' })
            }
            if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(packageName)) {
              return json({ ok: false, message: 'укажи имя пакета плагина' })
            }
            const cli = cliPath()
            if (cli === undefined) return json({ ok: false, message: 'CLI DeepSeek Harness не найден' })
            const removed = await gitInDir(undefined, cli, ['plugin', '--profile', 'desktop', 'remove', packageName])
            const added = await gitInDir(undefined, cli, ['plugin', '--profile', 'desktop', 'add', spec])
            return json({
              ok: added.ok,
              message: added.ok ? 'обновлено — перезапусти DSH' : 'обновление не удалось',
              output: (removed.output + '\n' + added.output).trim().slice(-1500),
            })
          }

          if (kind === 'copy-text') {
            // Буфер обмена заполняет host: в окне приложения navigator.clipboard
            // может быть недоступен, и копирование молча не срабатывало.
            const text = typeof body?.text === 'string' ? body.text : ''
            if (text === '') return json({ ok: false, message: 'нечего копировать' })
            const copied = await copyToClipboard(text)
            return json({ ok: copied, message: copied ? 'скопировано' : 'не удалось скопировать' })
          }

          if (kind === 'download-file') {
            const url = typeof body?.target === 'string' ? body.target.trim() : ''
            if (!/^https?:\/\/[^\s]+$/i.test(url)) return json({ ok: false, message: 'скачивать можно только http/https' })
            const name = typeof body?.name === 'string' && body.name !== '' ? body.name : url.split('/').pop() || 'download.bin'
            const safeName = name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'download.bin'
            const folder = join(homedir(), 'Downloads')
            const target = join(folder, safeName)
            try {
              const response = await fetch(url)
              if (!response.ok) return json({ ok: false, message: 'сервер ответил ' + response.status })
              const buffer = Buffer.from(await response.arrayBuffer())
              mkdirSync(folder, { recursive: true })
              writeFileSync(target, buffer)
              return json({ ok: true, message: 'сохранено в Загрузки', target })
            } catch (error) {
              return json({ ok: false, message: 'не удалось скачать: ' + String(error?.message ?? error) })
            }
          }

          if (kind === 'save-as') {
            const fileToSave = insideOpenRoots(body?.target)
            if (fileToSave === undefined) return json({ ok: false, message: 'этот файл сохранять нельзя' })
            if (!existsSync(fileToSave)) return json({ ok: false, message: 'файл не найден: ' + fileToSave })
            openSaveDialog(fileToSave)
            return json({ ok: true, message: 'открыт диалог сохранения' })
          }

          if (kind === 'open-in-editor') {
            const fileForEditor = insideOpenRoots(body?.target)
            if (fileForEditor === undefined) return json({ ok: false, message: 'этот файл открывать нельзя' })
            if (!existsSync(fileForEditor)) return json({ ok: false, message: 'файл не найден: ' + fileForEditor })
            const editor = await openInEditor(fileForEditor, body?.editor)
            return json({ ok: editor.ok, message: editor.ok ? 'открыто в ' + editor.editor : editor.message, target: fileForEditor })
          }

          if (kind === 'open-url') {
            // Ссылки открываем только http/https: никаких file:// и shell-команд.
            const url = typeof body?.target === 'string' ? body.target.trim() : ''
            if (!/^https?:\/\/[^\s]+$/i.test(url)) return json({ ok: false, message: 'ссылка должна начинаться с http:// или https://' })
            try {
              execFile(process.env.ComSpec ?? 'cmd.exe', ['/c', 'start', '', url], { windowsHide: true }, () => {})
            } catch {
              return json({ ok: false, message: 'не удалось открыть ссылку' })
            }
            return json({ ok: true, message: 'открываю ссылку', target: url })
          }

          if (kind === 'open-file') {
            const filePath = insideOpenRoots(body?.target)
            if (filePath === undefined) return json({ ok: false, message: 'этот путь открывать нельзя' })
            if (!existsSync(filePath)) return json({ ok: false, message: 'файл не найден: ' + filePath })
            try {
              execFile(process.env.ComSpec ?? 'cmd.exe', ['/c', 'start', '', filePath.replace(/\//g, '\\')], { windowsHide: true }, () => {})
            } catch {
              return json({ ok: false, message: 'не удалось открыть файл' })
            }
            return json({ ok: true, message: 'открываю файл', target: filePath })
          }

          if (kind === 'list-editors') {
            const editors = await detectEditors()
            return json({ ok: true, editors })
          }

          if (kind === 'download-file') {
            const url = typeof body?.target === 'string' ? body.target.trim() : ''
            if (!/^https?:\/\/[^\s]+$/i.test(url)) return json({ ok: false, message: 'скачивать можно только http/https' })
            const name = typeof body?.name === 'string' && body.name !== '' ? body.name : url.split('/').pop() || 'download.bin'
            const safeName = name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'download.bin'
            const folder = join(homedir(), 'Downloads')
            const target = join(folder, safeName)
            try {
              const response = await fetch(url)
              if (!response.ok) return json({ ok: false, message: 'сервер ответил ' + response.status })
              const buffer = Buffer.from(await response.arrayBuffer())
              mkdirSync(folder, { recursive: true })
              writeFileSync(target, buffer)
              return json({ ok: true, message: 'сохранено в Загрузки', target })
            } catch (error) {
              return json({ ok: false, message: 'не удалось скачать: ' + String(error?.message ?? error) })
            }
          }

          if (kind === 'save-as') {
            const fileToSave = insideOpenRoots(body?.target)
            if (fileToSave === undefined) return json({ ok: false, message: 'этот файл сохранять нельзя' })
            if (!existsSync(fileToSave)) return json({ ok: false, message: 'файл не найден: ' + fileToSave })
            openSaveDialog(fileToSave)
            return json({ ok: true, message: 'открыт диалог сохранения' })
          }

          if (kind === 'open-in-editor') {
            const fileForEditor = insideOpenRoots(body?.target)
            if (fileForEditor === undefined) return json({ ok: false, message: 'этот файл открывать нельзя' })
            if (!existsSync(fileForEditor)) return json({ ok: false, message: 'файл не найден: ' + fileForEditor })
            const editor = await openInEditor(fileForEditor, body?.editor)
            return json({ ok: editor.ok, message: editor.ok ? 'открыто в ' + editor.editor : editor.message, target: fileForEditor })
          }

          if (kind === 'open-folder') {
            const openTarget = insideOpenRoots(body?.target)
            if (openTarget === undefined) return json({ ok: false, message: 'этот путь открывать нельзя' })
            if (!existsSync(openTarget)) return json({ ok: false, message: 'каталог не найден: ' + openTarget })
            // Проводник Windows понимает только обратные слэши.
            const windowsPath = openTarget.replace(/\//g, '\\')
            try {
              execFile('explorer.exe', [windowsPath], { windowsHide: false }, () => {})
            } catch {
              // Запасной путь: start через cmd.
              execFile(process.env.ComSpec ?? 'cmd.exe', ['/c', 'start', '', windowsPath], { windowsHide: true }, () => {})
            }
            return json({ ok: true, message: 'открываю: ' + windowsPath, target: windowsPath })
          }

          return json({ ok: false, message: 'неизвестное действие: ' + kind })
        },
      })
    }, 'dsh-cards: action route')
  } catch (error) {
    console.error('[dsh-cards] маршрут действий недоступен:', error)
  }
}
