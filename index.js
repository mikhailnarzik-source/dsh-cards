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
import { execFile, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'

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

/** Последний выбранный редактор. Живёт только в памяти host-процесса,
 * поэтому при перезапуске DSH выбор сбрасывается. */
let lastEditorId = ''
/** Редакторы, найденные сканированием папок установки. */
const scannedEditors = []

/** Известные редакторы: имя, команда в PATH и прямые пути установки. */
const EDITORS = [
  { id: 'vscode', name: 'VS Code', command: 'code', exe: 'code.exe', paths: ['%LOCALAPPDATA%/Programs/Microsoft VS Code/Code.exe', '%PROGRAMFILES%/Microsoft VS Code/Code.exe'] },
  { id: 'vscode-insiders', name: 'VS Code Insiders', command: 'code-insiders', exe: 'Code - Insiders.exe', paths: ['%LOCALAPPDATA%/Programs/Microsoft VS Code Insiders/Code - Insiders.exe'] },
  { id: 'vscodium', name: 'VSCodium', command: 'codium', exe: 'VSCodium.exe', paths: ['%LOCALAPPDATA%/Programs/VSCodium/VSCodium.exe'] },
  { id: 'cursor', name: 'Cursor', command: 'cursor', exe: 'Cursor.exe', paths: ['%LOCALAPPDATA%/Programs/cursor/Cursor.exe'] },
  { id: 'windsurf', name: 'Windsurf', command: 'windsurf', exe: 'Windsurf.exe', paths: ['%LOCALAPPDATA%/Programs/Windsurf/Windsurf.exe'] },
  { id: 'trae', name: 'Trae', command: 'trae', exe: 'Trae.exe', paths: ['%LOCALAPPDATA%/Programs/Trae/Trae.exe'] },
  { id: 'zed', name: 'Zed', command: 'zed', exe: 'Zed.exe', paths: ['%LOCALAPPDATA%/Programs/Zed/Zed.exe'] },
  { id: 'sublime', name: 'Sublime Text', command: 'subl', exe: 'sublime_text.exe', paths: ['%PROGRAMFILES%/Sublime Text/sublime_text.exe', '%PROGRAMFILES%/Sublime Text 3/sublime_text.exe'] },
  { id: 'notepadpp', name: 'Notepad++', command: 'notepad++', exe: 'notepad++.exe', paths: ['%PROGRAMFILES%/Notepad++/notepad++.exe', '%PROGRAMFILES(x86)%/Notepad++/notepad++.exe'] },
  { id: 'notepad3', name: 'Notepad3', command: 'Notepad3', exe: 'Notepad3.exe', paths: ['%PROGRAMFILES%/Notepad3/Notepad3.exe'] },
  { id: 'atom', name: 'Atom', command: 'atom', exe: 'atom.exe', paths: ['%LOCALAPPDATA%/atom/atom.exe'] },
  { id: 'brackets', name: 'Brackets', command: 'brackets', exe: 'Brackets.exe', paths: ['%PROGRAMFILES%/Brackets/Brackets.exe'] },
  { id: 'idea', name: 'IntelliJ IDEA', command: 'idea64', exe: 'idea64.exe', paths: [] },
  { id: 'pycharm', name: 'PyCharm', command: 'pycharm64', exe: 'pycharm64.exe', paths: [] },
  { id: 'webstorm', name: 'WebStorm', command: 'webstorm64', exe: 'webstorm64.exe', paths: [] },
  { id: 'phpstorm', name: 'PhpStorm', command: 'phpstorm64', exe: 'phpstorm64.exe', paths: [] },
  { id: 'goland', name: 'GoLand', command: 'goland64', exe: 'goland64.exe', paths: [] },
  { id: 'clion', name: 'CLion', command: 'clion64', exe: 'clion64.exe', paths: [] },
  { id: 'rider', name: 'Rider', command: 'rider64', exe: 'rider64.exe', paths: [] },
  { id: 'rubymine', name: 'RubyMine', command: 'rubymine64', exe: 'rubymine64.exe', paths: [] },
  { id: 'android-studio', name: 'Android Studio', command: 'studio64', exe: 'studio64.exe', paths: ['%PROGRAMFILES%/Android/Android Studio/bin/studio64.exe'] },
  { id: 'visualstudio', name: 'Visual Studio', command: 'devenv', exe: 'devenv.exe', paths: [] },
  { id: 'vim', name: 'Vim', command: 'vim', exe: 'vim.exe', paths: [] },
  { id: 'neovim', name: 'Neovim', command: 'nvim', exe: 'nvim.exe', paths: ['%LOCALAPPDATA%/nvim/bin/nvim.exe', '%PROGRAMFILES%/Neovim/bin/nvim.exe'] },
  { id: 'emacs', name: 'Emacs', command: 'emacs', exe: 'emacs.exe', paths: [] },
  { id: 'notepad', name: 'Блокнот', command: 'notepad', exe: 'notepad.exe', paths: [] },
]

/** Похоже ли имя папки на редактор и как его подписать. */
const SCAN_HINTS = [
  { match: /microsoft vs code/i, id: 'vscode-scanned', name: 'VS Code' },
  { match: /vscodium/i, id: 'vscodium-scanned', name: 'VSCodium' },
  { match: /cursor/i, id: 'cursor-scanned', name: 'Cursor' },
  { match: /windsurf/i, id: 'windsurf-scanned', name: 'Windsurf' },
  { match: /zed/i, id: 'zed-scanned', name: 'Zed' },
  { match: /sublime/i, id: 'sublime-scanned', name: 'Sublime Text' },
  { match: /notepad\+\+/i, id: 'notepadpp-scanned', name: 'Notepad++' },
  { match: /notepad3/i, id: 'notepad3-scanned', name: 'Notepad3' },
  { match: /neovim/i, id: 'neovim-scanned', name: 'Neovim' },
  { match: /jetbrains/i, id: 'jetbrains-scanned', name: 'JetBrains' },
  { match: /android studio/i, id: 'studio-scanned', name: 'Android Studio' },
  { match: /atom/i, id: 'atom-scanned', name: 'Atom' },
  { match: /brackets/i, id: 'brackets-scanned', name: 'Brackets' },
]

/** Найти исполняемый файл в папке на глубине до двух уровней. */
function findExecutable(dir) {
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return '' }
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith('.exe')) continue
    return join(dir, entry.name)
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nested = findExecutable(join(dir, entry.name))
    if (nested !== '') return nested
  }
  return ''
}

/** Просканировать типовые папки установки приложений. */
function scanEditorFolders() {
  const roots = [
    process.env['ProgramFiles'] ?? '',
    process.env['ProgramFiles(x86)'] ?? '',
    process.env['LOCALAPPDATA'] ? join(process.env['LOCALAPPDATA'], 'Programs') : '',
  ].filter((root) => root !== '')
  for (const root of roots) {
    let entries = []
    try { entries = readdirSync(root, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const hint = SCAN_HINTS.find((item) => item.match.test(entry.name))
      if (hint === undefined) continue
      const exe = findExecutable(join(root, entry.name))
      if (exe === '') continue
      if (scannedEditors.some((editor) => editor.path === exe)) continue
      scannedEditors.push({ id: hint.id + '-' + scannedEditors.length, name: hint.name, command: exe, exe, paths: [exe], path: exe })
    }
  }
  return scannedEditors
}

/** Развернуть %ПЕРЕМЕННУЮ% в пути. */
function expandEnv(template) {
  let result = template
  for (let step = 0; step < 5; step += 1) {
    const match = /%([A-Za-z_()]+)%/.exec(result)
    if (match === null) break
    const value = process.env[match[1]] ?? ''
    if (value === '') return ''
    result = result.replace(match[0], value)
  }
  return result
}

/** Свои редакторы из %USERPROFILE%/.dsh/dsh-cards/editors.json. */
function customEditors() {
  try {
    const file = join(homedir(), '.dsh', 'dsh-cards', 'editors.json')
    if (!existsSync(file)) return []
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.editors) ? parsed.editors : []
    return list
      .filter((item) => item !== null && typeof item === 'object' && typeof item.command === 'string' && item.command !== '')
      .map((item) => ({
        id: typeof item.id === 'string' && item.id !== '' ? item.id : item.command,
        name: typeof item.name === 'string' && item.name !== '' ? item.name : item.command,
        command: item.command,
        exe: typeof item.exe === 'string' ? item.exe : item.command,
        paths: Array.isArray(item.paths) ? item.paths.filter((path) => typeof path === 'string') : [],
      }))
  } catch {
    return []
  }
}

/** Все редакторы: встроенные и добавленные пользователем. */
function allEditors() {
  return [...EDITORS, ...scannedEditors, ...customEditors()]
}

/** Команда запуска редактора, если он установлен. */
function editorAvailable(editor) {
  return new Promise((resolveAvailable) => {
    execFile(process.env.ComSpec ?? 'cmd.exe', ['/c', 'where', editor.command], { windowsHide: true, timeout: 8000 }, (error) => {
      if (error === null) { resolveAvailable(editor.command); return }
      for (const template of editor.paths ?? []) {
        const full = expandEnv(template)
        if (full !== '' && existsSync(full)) { resolveAvailable(full); return }
      }
      resolveAvailable('')
    })
  })
}

/** Путь к настоящему .exe для редактора (обёртки .cmd разворачиваем). */
async function editorExe(editor) {
  const launch = editor.launch
  if (typeof launch !== 'string' || launch === '') return ''
  if (launch.toLowerCase().endsWith('.exe') && existsSync(launch)) return launch
  return new Promise((resolveExe) => {
    const probe = launch.replace(/\.(cmd|bat)$/i, '')
    execFile(process.env.ComSpec ?? 'cmd.exe', ['/c', 'where', probe], { windowsHide: true, timeout: 8000 }, (error, stdout) => {
      if (error !== null) { resolveExe(''); return }
      const first = String(stdout ?? '').split(/\r?\n/)[0]?.trim() ?? ''
      if (first === '') { resolveExe(''); return }
      if (first.toLowerCase().endsWith('.exe')) { resolveExe(first); return }
      // Обёртка .cmd: ищем .exe рядом или на уровень выше.
      const dir = dirname(first)
      const search = (folder, depth) => {
        if (depth < 0) return ''
        let entries = []
        try { entries = readdirSync(folder) } catch { return '' }
        const exe = entries.find((name) => name.toLowerCase().endsWith('.exe'))
        if (exe !== undefined) return join(folder, exe)
        return search(dirname(folder), depth - 1)
      }
      const found = search(dir, 2)
      if (found !== '') { resolveExe(found); return }
      // Известные места установки: обёртка может лежать отдельно от .exe.
      const known = {
        code: [join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Microsoft VS Code', 'Code.exe'), join(process.env.ProgramFiles ?? '', 'Microsoft VS Code', 'Code.exe')],
        cursor: [join(process.env.LOCALAPPDATA ?? '', 'Programs', 'cursor', 'Cursor.exe')],
        'notepad++': [join(process.env.ProgramFiles ?? '', 'Notepad++', 'notepad++.exe')],
        subl: [join(process.env.ProgramFiles ?? '', 'Sublime Text', 'sublime_text.exe')],
      }
      const candidates = known[probe.toLowerCase()] ?? []
      resolveExe(candidates.find((candidate) => existsSync(candidate)) ?? '')
    })
  })
}

/** PNG-иконка приложения в виде data URL. */
const iconCache = new Map()
async function editorIcon(exePath) {
  if (exePath === '' || !existsSync(exePath)) return ''
  const cached = iconCache.get(exePath)
  if (cached !== undefined) return cached
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    "$icon = [System.Drawing.Icon]::ExtractAssociatedIcon('" + exePath.replace(/'/g, "''") + "')",
    "if ($icon -eq $null) { return }",
    '$bitmap = $icon.ToBitmap()',
    '$stream = New-Object System.IO.MemoryStream',
    '$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)',
    '[Convert]::ToBase64String($stream.ToArray())',
  ].join(String.fromCharCode(10))
  const icon = await new Promise((resolveIcon) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 20000 }, (error, stdout) => {
      if (error !== null) { resolveIcon(''); return }
      const base64 = String(stdout ?? '').trim()
      resolveIcon(base64 === '' ? '' : 'data:image/png;base64,' + base64)
    })
  })
  iconCache.set(exePath, icon)
  return icon
}

/** Дружелюбные имена программ по имени exe. */
const APP_NAMES = {
  notepad: 'Блокнот',
  code: 'Visual Studio Code',
  winrar: 'WinRAR',
  explorer: 'Проводник',
  acrobat: 'Adobe Acrobat',
  acrord32: 'Adobe Acrobat',
  sublime_text: 'Sublime Text',
  notepadpp: 'Notepad++',
  mspaint: 'Paint',
  winword: 'Word',
  powerpnt: 'PowerPoint',
  vlc: 'VLC media player',
  cmd: 'Командная строка',
}

/** Команда открытия по умолчанию для расширения (UserChoice + реестр). */
function defaultCommandFor(extension) {
  const script = [
    "$ext = '" + extension.replace(/'/g, "''") + "'",
    "$key = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\' + $ext + '\\UserChoice'",
    '$prog = (Get-ItemProperty $key -ErrorAction SilentlyContinue).ProgId',
    "if (-not $prog) { $line = (& cmd.exe /c \"assoc $ext\" 2>$null); if ($line -match '=') { $prog = ($line -split '=', 2)[1].Trim() } }",
    'if (-not $prog) { return }',
    "$cmdKey = 'Registry::HKEY_CLASSES_ROOT\\' + $prog + '\\shell\\open\\command'",
    '$cmd = (Get-ItemProperty $cmdKey -ErrorAction SilentlyContinue)."(default)"',
    'if (-not $cmd) { $ft = (& cmd.exe /c "ftype $prog" 2>$null); if ($ft -match "=") { $cmd = ($ft -split "=", 2)[1].Trim() } }',
    'if ($cmd) { Write-Output $cmd }',
  ].join(String.fromCharCode(10))
  return new Promise((resolveCommand) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 15000 }, (error, stdout, stderr) => {
      resolveCommand(error === null ? String(stdout ?? '').trim() : '')
    })
  })
}

/** Все приложения из системного списка «Открыть с помощью». */
async function appsForFile(filePath) {
  try {
    const extension = extname(filePath)
    if (extension === '') return []
    const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'apps.ps1')
    if (!existsSync(scriptPath)) return []
    const raw = await new Promise((resolveApps) => {
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Extension', extension], { windowsHide: true, timeout: 30000 }, (error, stdout) => {
        resolveApps(error === null ? String(stdout ?? '') : '')
      })
    })
    const text = raw.trim()
    if (text === '') return []
    const parsed = JSON.parse(text)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    const apps = []
    for (const item of items) {
      if (item === null || typeof item !== 'object') continue
      const command = typeof item.command === 'string' ? item.command.trim() : ''
      const iconPath = typeof item.iconPath === 'string' ? item.iconPath.trim() : ''
      let exePath = command.toLowerCase().endsWith('.exe') && existsSync(command) ? command : ''
      if (exePath === '' && iconPath.toLowerCase().endsWith('.exe') && existsSync(iconPath)) exePath = iconPath
      if (exePath === '') continue
      const name = typeof item.name === 'string' ? item.name.trim() : ''
      if (name === '') continue
      const icon = await editorIcon(exePath)
      apps.push({ path: exePath, name, icon })
    }
    return apps
  } catch {
    return []
  }
}

/** Иконка программы, связанной с файлом (или самого файла). */
async function fileIcon(filePath) {
  if (filePath === '' || !existsSync(filePath)) return ''
  const cached = iconCache.get(filePath)
  if (cached !== undefined) return cached
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    "$icon = [System.Drawing.Icon]::ExtractAssociatedIcon('" + filePath.replace(/'/g, "''") + "')",
    "if ($icon -eq $null) { return }",
    '$bitmap = $icon.ToBitmap()',
    '$stream = New-Object System.IO.MemoryStream',
    '$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)',
    '[Convert]::ToBase64String($stream.ToArray())',
  ].join(String.fromCharCode(10))
  const icon = await new Promise((resolveIcon) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 20000 }, (error, stdout) => {
      if (error !== null) { resolveIcon(''); return }
      const base64 = String(stdout ?? '').trim()
      resolveIcon(base64 === '' ? '' : 'data:image/png;base64,' + base64)
    })
  })
  iconCache.set(filePath, icon)
  return icon
}

/** Программа по умолчанию для файла: имя, exe и иконка. */
async function defaultAppFor(filePath) {
  const fallback = { name: 'Открыть (по умолчанию)', exe: '', icon: await fileIcon(filePath) }
  try {
    const extension = extname(filePath)
    if (extension === '') return fallback
    const command = await defaultCommandFor(extension)
    if (command === '') return fallback
    const quoted = /"([^"]+?\.exe)"/i.exec(command)
    const plain = quoted === null ? /([A-Za-z]:\\[^"]+?\.exe)/i.exec(command) : null
    const exePath = quoted !== null ? quoted[1] : plain !== null ? plain[1] : ''
    const base = exePath === '' ? '' : (exePath.split(/[\\/]/).pop()?.replace(/\.exe$/i, '').toLowerCase() ?? '')
    const icon = exePath === '' ? await fileIcon(filePath) : (await editorIcon(exePath)) || (await fileIcon(filePath))
    return { name: APP_NAMES[base] ?? (base === '' ? fallback.name : base), exe: exePath, icon }
  } catch {
    return fallback
  }
}

/** Список установленных редакторов. */
async function detectEditors() {
  scanEditorFolders()
  const found = []
  const seen = new Set()
  for (const editor of allEditors()) {
    const launch = await editorAvailable(editor)
    if (launch === '') continue
    const key = editor.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ id: editor.id, name: editor.name, launch })
  }
  return found
}

/** Открыть файл в редакторе: конкретном или последнем выбранном. */
function openInEditor(filePath, requested) {
  return new Promise((resolveEditor) => {
    let candidates = allEditors().map((editor) => ({ ...editor }))
    if (typeof requested === 'string' && requested !== '' && requested !== 'auto') {
      const wanted = candidates.filter((editor) => editor.id === requested)
      if (wanted.length === 0) {
        resolveEditor({ ok: false, editor: '', message: 'неизвестный редактор: ' + requested })
        return
      }
      candidates = wanted
    }

    // Запускаем и не ждём закрытия: редактор живёт своей жизнью.
    const launchDetached = (editor) => {
      try {
        const isShim = /^[A-Za-z0-9_.+-]+$/.test(editor.command)
        const program = isShim ? (process.env.ComSpec ?? 'cmd.exe') : editor.command
        const args = isShim ? ['/c', editor.command, filePath] : [filePath]
        const child = spawn(program, args, { detached: true, stdio: 'ignore', windowsHide: true })
        child.unref()
        return true
      } catch {
        try {
          const child = spawn(editor.exe, [filePath], { detached: true, stdio: 'ignore', windowsHide: false })
          child.unref()
          return true
        } catch {
          return false
        }
      }
    }

    for (const editor of candidates) {
      if (launchDetached(editor)) {
        resolveEditor({ ok: true, editor: editor.name, id: editor.id })
        return
      }
    }
    resolveEditor({ ok: false, editor: '', message: 'не удалось запустить редактор' })
  })
}

/** Показать диалог выбора любой программы и вернуть путь к ней. */
function chooseExecutable() {
  return new Promise((resolveChoice) => {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms | Out-Null',
      '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
      "$dialog.Title = 'Выберите редактор'",
      "$dialog.Filter = 'Программы (*.exe)|*.exe'",
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.FileName }',
    ].join(String.fromCharCode(10))
    execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: false, timeout: 120_000 }, (error, stdout) => {
      if (error !== null) { resolveChoice(''); return }
      resolveChoice(String(stdout ?? '').trim())
    })
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

/** Есть ли в Windows ассоциация для расширения файла. */
function hasFileAssociation(filePath) {
  return new Promise((resolveAssoc) => {
    const match = /\.([A-Za-z0-9]+)$/.exec(filePath)
    if (match === null) { resolveAssoc(false); return }
    execFile(process.env.ComSpec ?? 'cmd.exe', ['/c', 'assoc', '.' + match[1]], { windowsHide: true, timeout: 8000 }, (error, stdout) => {
      const text = String(stdout ?? '').trim()
      resolveAssoc(error === null && text !== '' && !text.includes('not found') && !text.includes('не найден'))
    })
  })
}

/** Открыть файл или ссылку программой по умолчанию. */
function startProcess(target) {
  try {
    const escaped = String(target).replace(/'/g, "''")
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', "Start-Process -FilePath '" + escaped + "'"],
      { detached: true, stdio: 'ignore', windowsHide: true },
    )
    child.unref()
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

          if (kind === 'list-editors') {
            const editors = await detectEditors()
            for (const editor of editors) {
              const exePath = await editorExe(editor)
              editor.icon = await editorIcon(exePath)
              editor.default = editor.id === 'notepad'
            }
            const last = editors.find((editor) => editor.id === lastEditorId) ?? null
            const target = typeof body?.target === 'string' ? insideOpenRoots(body.target) : undefined
            const defaultApp = target === undefined ? null : await defaultAppFor(target)
            const apps = target === undefined ? [] : await appsForFile(target)
            return json({ ok: true, editors, last, defaultApp, apps })
          }

          if (kind === 'open-with') {
            const filePath = insideOpenRoots(body?.target)
            if (filePath === undefined) return json({ ok: false, message: 'этот файл открывать нельзя' })
            if (!existsSync(filePath)) return json({ ok: false, message: 'файл не найден: ' + filePath })
            const appPath = typeof body?.app === 'string' ? body.app : ''
            if (!appPath.toLowerCase().endsWith('.exe') || !existsSync(appPath)) {
              return json({ ok: false, message: 'программа не найдена' })
            }
            try {
              const child = spawn(appPath, [filePath], { detached: true, stdio: 'ignore' })
              child.unref()
              return json({ ok: true, message: 'открыто' })
            } catch {
              return json({ ok: false, message: 'не удалось запустить программу' })
            }
          }

          if (kind === 'pick-editor') {
            const chosen = await chooseExecutable()
            if (chosen === '') return json({ ok: false, message: 'программа не выбрана' })
            const parts = String(chosen).split(/[\\/]/)
            const name = (parts[parts.length - 1] ?? 'Программа').replace(/\.exe$/i, '')
            const id = 'custom-' + scannedEditors.length
            scannedEditors.push({ id, name, command: chosen, exe: chosen, paths: [chosen], path: chosen })
            lastEditorId = id
            return json({ ok: true, editor: { id, name }, target: chosen })
          }

          if (kind === 'open-in-editor') {
            const fileForEditor = insideOpenRoots(body?.target)
            if (fileForEditor === undefined) return json({ ok: false, message: 'этот файл открывать нельзя' })
            if (!existsSync(fileForEditor)) return json({ ok: false, message: 'файл не найден: ' + fileForEditor })
            const requested = typeof body?.editor === 'string' ? body.editor : ''
            const editor = await openInEditor(fileForEditor, requested !== '' ? requested : lastEditorId)
            if (editor.ok) lastEditorId = requested !== '' ? requested : lastEditorId
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
            const windowsPath = filePath.replaceAll(String.fromCharCode(92), '/').replaceAll('/', String.fromCharCode(92))
            // Если у расширения нет ассоциации, Windows молча ничего не делает —
            // тогда открываем в редакторе.
            const associated = await hasFileAssociation(windowsPath)
            if (associated) {
              startProcess(windowsPath)
              return json({ ok: true, message: 'открываю файл', target: windowsPath })
            }
            const editor = await openInEditor(filePath, lastEditorId)
            if (editor.ok) return json({ ok: true, message: 'нет ассоциации, открыто в ' + editor.editor, target: filePath })
            return json({ ok: false, message: 'нет программы для этого типа файла: выберите редактор в карточке' })
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
