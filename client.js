/**
 * Browser half of `dsh-cards`.
 *
 * Два места:
 *  - карточка в списке плагинов: формат блока и живой предпросмотр;
 *  - отрисовка блока ```dsh-card в ответах ассистента.
 *
 * Слот блоков кода может быть одиночным, поэтому регистрируемся с приоритетом
 * выше нуля: при конфликте система оставит свой рендерер, а не упадёт.
 */
window.__ModuleLoader__.load({
  id: 'dsh-cards',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const h = React.createElement

    const NS = 'dshCards'
    const LANGUAGE = 'dsh-card'

    const TONES = {
      info: 'rgba(84,126,214,0.85)',
      success: 'rgba(47,158,68,0.85)',
      warning: 'rgba(232,89,12,0.9)',
      danger: 'rgba(209,36,47,0.9)',
    }

    const en = {
      title: 'Cards',
      heading: 'Cards in answers',
      hint: 'Скопируйте пример ниже и вставьте его в сообщение ассистенту или в свой ответ — блок превратится в карточку.',
      example: 'Example',
      preview: 'Preview',
      broken: 'Could not read the block',
      open: 'Open',
      collapse: 'Collapse',
      copy: 'Copy example',
      copied: 'Copied — paste it into a message',
    }
    const ru = {
      title: 'Карточки',
      heading: 'Карточки в ответах',
      hint: 'Скопируйте пример ниже и вставьте его в сообщение ассистенту или в свой ответ — блок превратится в карточку.',
      example: 'Пример',
      preview: 'Предпросмотр',
      broken: 'Не удалось прочитать блок',
      open: 'Открыть',
      collapse: 'Свернуть',
      copy: 'Скопировать пример',
      copied: 'Скопировано — вставьте в сообщение',
    }

    const S = {
      card: { display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', fontSize: 13 },
      panel: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240, flex: '1 1 300px' },
      area: {
        width: '100%',
        boxSizing: 'border-box',
        minHeight: 140,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid rgba(128,128,128,0.35)',
        background: 'transparent',
        color: 'inherit',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        resize: 'vertical',
      },
      button: {
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid rgba(128,128,128,0.35)',
        background: 'rgba(128,128,128,0.12)',
        color: 'inherit',
        font: 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        alignSelf: 'flex-start',
      },
      cardBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid rgba(128,128,128,0.28)',
        background: 'rgba(128,128,128,0.06)',
        minWidth: 240,
        flex: '1 1 300px',
      },
    }

    let translate = (key) => key

    /** Разобрать блок; при ошибке — понятная причина. */
    /** Кнопка-шеврон: развернуть и свернуть. Виден в любой теме (currentColor). */
    function ToggleIcon({ open, onClick }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          title: open ? 'Свернуть' : 'Открыть',
          'aria-label': open ? 'Свернуть' : 'Открыть',
          'aria-expanded': open ? 'true' : 'false',
          style: {
            position: 'absolute',
            // Свёрнутая карточка: по центру по вертикали. Развёрнутая: в углу.
            top: open ? 8 : '50%',
            transform: open ? 'none' : 'translateY(-50%)',
            right: 8,
            zIndex: 2,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            padding: 0,
            borderRadius: 8,
            border: '1px solid rgba(128,128,128,0.32)',
            background: 'rgba(128,128,128,0.1)',
            color: 'inherit',
            cursor: 'pointer',
          },
        },
        h(
          'svg',
          {
            width: 16,
            height: 16,
            viewBox: '0 0 24 24',
            fill: 'none',
            'aria-hidden': 'true',
            focusable: 'false',
            style: { transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' },
          },
          h('path', {
            d: 'M6 15l6-6 6 6',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
        ),
      )
    }

    function parseCard(text) {
      if (typeof text !== 'string' || text.trim() === '') return { ok: false, reason: 'пустой блок' }
      let raw
      try {
        raw = JSON.parse(text)
      } catch (error) {
        return { ok: false, reason: String(error?.message ?? error) }
      }
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'ожидался объект' }
      const card = {
        title: typeof raw.title === 'string' ? raw.title : '',
        subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
        rows: Array.isArray(raw.rows)
          ? raw.rows
              .filter((row) => row !== null && typeof row === 'object')
              .slice(0, 40)
              .map((row) => ({
                label: typeof row.label === 'string' ? row.label : '',
                value: row.value === undefined || row.value === null ? '' : String(row.value),
              }))
          : [],
        list: Array.isArray(raw.list) ? raw.list.filter((item) => typeof item === 'string').slice(0, 40) : [],
        note: typeof raw.note === 'string' ? raw.note : '',
        tone: ['info', 'success', 'warning', 'danger'].includes(raw.tone) ? raw.tone : 'info',
      }
      const empty =
        card.title === '' && card.subtitle === '' && card.note === '' && card.rows.length === 0 && card.list.length === 0
      return empty ? { ok: false, reason: 'карточка пустая' } : { ok: true, card }
    }

    /** Сама карточка: используется и в предпросмотре, и в ответе ассистента. */
    function CardView({ card, actions, copyText }) {
      return h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(128,128,128,0.28)',
            borderLeft: `3px solid ${TONES[card.tone] ?? TONES.info}`,
            background: 'rgba(128,128,128,0.06)',
            fontSize: 13,
          },
        },
        card.title !== '' ? h('span', { style: { fontWeight: 600, fontSize: 13.5 } }, card.title) : null,
        card.subtitle !== '' ? h('span', { style: { fontSize: 12, opacity: 0.75 } }, card.subtitle) : null,
        card.rows.length > 0
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
              ...card.rows.map((row, index) =>
                h(
                  'div',
                  { key: index, style: { display: 'flex', gap: 12, justifyContent: 'space-between' } },
                  h('span', { style: { opacity: 0.75 } }, row.label),
                  h('span', { style: { fontWeight: 600, textAlign: 'right' } }, row.value),
                ),
              ),
            )
          : null,
        card.list.length > 0
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 3 } },
              ...card.list.map((item, index) =>
                h(
                  'div',
                  { key: index, style: { display: 'flex', gap: 8 } },
                  h('span', { style: { opacity: 0.5 } }, '•'),
                  h('span', null, item),
                ),
              ),
            )
          : null,
        typeof copyText === 'string' && copyText !== ''
          ? h(
              'pre',
              {
                style: {
                  margin: '2px 0 0',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(128,128,128,0.25)',
                  background: 'rgba(0,0,0,0.18)',
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  userSelect: 'all',
                  maxWidth: '100%',
                },
              },
              copyText,
            )
          : null,
        card.note !== '' ? h('span', { style: { fontSize: 12, opacity: 0.7 } }, card.note) : null,
        (Array.isArray(actions) && actions.length > 0) || (typeof copyText === 'string' && copyText !== '')
          ? h(CardActions, { actions, copyText })
          : null,
)
    }

    /** Рендерер блока кода ```dsh-card. */
    /** Стили кнопок: одинаковый вид у всех, заметное наведение. */
    const ACTION_STYLES = [
      '.dshc-actions {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  margin-top: 12px;',
      '}',
      '.dshc-action {',
      '  flex: 0 0 auto;',
      '  white-space: nowrap;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  height: 30px;',
      '  padding: 0 14px;',
      '  border-radius: 8px;',
      '  border: 1px solid rgba(106,139,208,0.55);',
      '  background: rgba(106,139,208,0.28);',
      '  color: inherit;',
      '  font: inherit;',
      '  font-size: 12.5px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: background .14s ease, border-color .14s ease, transform .08s ease;',
      '}',
      '.dshc-action:hover:not(:disabled) {',
      '  background: rgba(106,139,208,0.46);',
      '  border-color: rgba(106,139,208,0.9);',
      '}',
      '.dshc-action:active:not(:disabled) { transform: translateY(1px); }',
      '.dshc-action:disabled { opacity: .6; cursor: progress; }',
    ].join('\n')

    /** Скопировать текст в системный буфер через host. */
    async function copyTextToHost(text) {
      const response = await fetch('/api/dsh-cards/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'copy-text', text }),
      })
      const data = await response.json()
      return data?.ok === true
    }

    /** Кнопки действий карточки: одинаковый вид, переключатель переноса строк. */
    function CardActions({ actions, copyText }) {
      const [state, setState] = React.useState({ busy: '', note: '' })
      const [copied, setCopied] = React.useState(false)
      const ACTIONS_PATH = '/api/dsh-cards/action'

      const run = async (action) => {
        setState({ busy: action.label, note: '' })
        if (action.kind === 'copy') {
          const text = action.command !== '' ? action.command : copyText
          if (text === '') { setState({ busy: '', note: 'нечего копировать' }); return }
          let copied = false
          try {
            copied = await copyTextToHost(text)
          } catch {
            copied = false
          }
          setCopied(copied)
          setState({ busy: '', note: copied ? 'скопировано: ' + text.slice(0, 60) : 'не удалось скопировать' })
          if (copied) setTimeout(() => setCopied(false), 1600)
          return
        }
        try {
          const response = await fetch(ACTIONS_PATH, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: action.kind, target: action.target, plugin: action.plugin }),
          })
          const data = await response.json()
          setState({ busy: '', note: data?.ok === true ? (data.message ?? 'готово') : (data?.message ?? 'ошибка') })
        } catch (error) {
          setState({ busy: '', note: 'не удалось: ' + String(error?.message ?? error) })
        }
      }

      const copy = async () => {
        const command = typeof copyText === 'string' && copyText !== '' ? copyText : actions.map((item) => item.command ?? '').filter((line) => line !== '').join('\n')
        if (command === '') { setState({ busy: '', note: 'нечего копировать' }); return }
        const confirm = () => {
          setCopied(true)
          setState({ busy: '', note: 'команда скопирована' })
          setTimeout(() => setCopied(false), 1600)
        }
        // Копируем через host: в окне приложения системный буфер надёжнее браузерного.
        try {
          if (await copyTextToHost(command)) { confirm(); return }
        } catch {
          // ниже попробуем браузерный способ
        }
        try {
          await navigator.clipboard.writeText(command)
          confirm()
        } catch {
          setState({ busy: '', note: 'не удалось скопировать' })
        }
      }

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h('style', null, ACTION_STYLES),
        h(
          'div',
          {
            className: 'dshc-actions',
            style: {
              flexWrap: 'wrap',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              overflow: 'hidden',
            },
          },
          ...actions.map((action) =>
            h(
              'button',
              {
                key: action.label,
                type: 'button',
                className: 'dshc-action',
                disabled: state.busy !== '',
                onClick: () => void run(action),
              },
              state.busy === action.label ? 'выполняю…' : action.label,
            ),
          ),
          copyText === '' || actions.some((item) => item.kind === 'copy')
            ? null
            : h(
                'button',
                { type: 'button', className: 'dshc-action', onClick: () => void copy() },
                copied ? 'Скопировано' : 'Копировать команду',
              ),
        ),
        state.note !== '' ? h('span', { style: { fontSize: 11.5, opacity: 0.75 } }, state.note) : null,
      )
    }

    function FenceCard(props) {
      const language = props?.language ?? props?.lang ?? props?.info ?? ''
      if (String(language).trim() !== LANGUAGE) return null
      const content = props?.content ?? props?.code ?? props?.text ?? props?.value ?? ''
      const parsed = parseCard(String(content))
      if (!parsed.ok) return null
      // Что можно сделать с карточкой — выводим из содержимого.
      let raw = {}
      try {
        raw = JSON.parse(String(content)) ?? {}
      } catch {
        raw = {}
      }

      const actions = []
      if (typeof raw.repo === 'string' && raw.repo !== '') {
        actions.push({ label: 'Опубликовать', kind: 'git-push', target: raw.repo })
      }
      if (typeof raw.folder === 'string' && raw.folder !== '') {
        actions.push({ label: 'Открыть в папке', kind: 'open-folder', target: raw.folder })
      }
      for (const item of Array.isArray(raw.actions) ? raw.actions : []) {
        if (item !== null && typeof item === 'object' && typeof item.label === 'string') {
          actions.push({
            label: item.label,
            kind: typeof item.kind === 'string' ? item.kind : '',
            target: typeof item.target === 'string' ? item.target : '',
            plugin: typeof item.plugin === 'string' ? item.plugin : '',
            command: typeof item.command === 'string' ? item.command : '',
          })
        }
      }

      // Текст для копирования: ровно то, что видно в карточке.
      const copyLines = []
      if (typeof raw.code === 'string' && raw.code.trim() !== '') copyLines.push(raw.code.trim())
      if (typeof raw.command === 'string' && raw.command.trim() !== '') copyLines.push(raw.command.trim())
      if (Array.isArray(raw.commands)) {
        for (const line of raw.commands) if (typeof line === 'string' && line.trim() !== '') copyLines.push(line.trim())
      }
      const hasExplicitText = copyLines.length > 0
      if (!hasExplicitText) for (const action of actions) {
        if (action.command !== '') { copyLines.push(action.command); continue }
        if (action.kind === 'git-push') copyLines.push('git -C "' + action.target + '" push origin main')
        // open-folder не добавляет текст для копирования: это действие, а не команда
        if (action.kind === 'run-tests') copyLines.push('cd "' + action.target + '" && node --test')
        if (action.kind === 'dsh-plugin-update') copyLines.push('dsh plugin --profile desktop remove ' + action.plugin + ' && dsh plugin add ' + action.target)
      }
      const copyText = copyLines.join('\n')

      return h(CardView, { card: parsed.card, actions, copyText })
    }

    const EXAMPLE = JSON.stringify(
      {
        title: 'Проверка релиза',
        subtitle: 'плагин dsh-sessions',
        rows: [
          { label: 'Версия', value: '1.0.20' },
          { label: 'Тесты', value: '36 / 36' },
        ],
        list: ['Собрать пакет', 'Опубликовать в GitHub'],
        note: 'Заметка мелким шрифтом',
        tone: 'success',
      },
      null,
      2,
    )

        /** Рамка карточки: тот же вид, что у остальных наших плагинов. */
    function CardFrame({ children }) {
      return h(
        'div',
        {
          style: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '10px 44px 12px 12px',
            borderRadius: 10,
            border: '1px solid rgba(128,128,128,0.28)',
            background: 'rgba(128,128,128,0.07)',
            boxSizing: 'border-box',
          },
        },
        children,
      )
    }

function CardsCard() {
      const t = (key) => translate(key)
      const [open, setOpen] = React.useState(false)
      const [text, setText] = React.useState(EXAMPLE)
      const [notice, setNotice] = React.useState('')

      if (!open) {
        return h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(128,128,128,0.22)',
              background: 'rgba(128,128,128,0.05)',
              fontSize: 13,
            },
          },
          h('span', { style: { fontWeight: 600 } }, t('heading')),
          h('span', { style: { fontSize: 12, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t('hint')),
          h(ToggleIcon, { open: false, onClick: () => setOpen(true) }),
        )
      }

      const parsed = parseCard(text)

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        h('span', { style: { fontSize: 13.5, fontWeight: 600 } }, t('heading')),
        h('span', { style: { fontSize: 12, opacity: 0.7, lineHeight: 1.5 } }, t('hint')),
        h(
          'div',
          { style: S.card },
          h(
            'div',
            { style: S.panel },
            h('span', { style: { fontSize: 12, fontWeight: 600, opacity: 0.8 } }, t('example')),
            h('textarea', { style: S.area, value: text, onChange: (event) => setText(event.target.value) }),
          ),
          h(
            'div',
            { style: S.panel },
            h('span', { style: { fontSize: 12, fontWeight: 600, opacity: 0.8 } }, t('preview')),
            parsed.ok
              ? h(CardView, { card: parsed.card })
              : h('span', { style: { fontSize: 12, color: '#d1242f' } }, `${t('broken')}: ${parsed.reason}`),
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
          h(
            'button',
            {
              style: S.button,
              onClick: async () => {
                try {
                  await navigator.clipboard.writeText('\u0060\u0060\u0060dsh-card\n' + text + '\n\u0060\u0060\u0060')
                  setNotice(t('copied'))
                } catch {
                  setNotice(t('copied'))
                }
              },
            },
            t('copy'),
          ),
          h(ToggleIcon, { open: true, onClick: () => setOpen(false) }),
        notice !== '' ? h('span', { style: { fontSize: 12, opacity: 0.75 } }, notice) : null,
        ),
      )
    }

    function apply(ctx) {
      ctx.locale.register(NS, { en, ru })
      translate = ctx.locale.bind(NS)

      try {
        ctx.slots.inject('plugins.item', () =>
          ctx.slots.register(
            {
              name: 'plugins.item',
              id: 'dsh-cards',
              order: 57,
              label: () => translate('title'),
              locale: NS,
            },
            () => h(CardFrame, null, h(CardsCard)),
          ),
        )
      } catch (error) {
        console.error('[dsh-cards] карточка недоступна:', error)
      }

      // Приоритет 5: если слот блоков одиночный, система оставит свой рендерер
      // и не упадёт. Падение при загрузке уже случалось — второй раз нельзя.
      try {
        ctx.slots.inject('conversation.chat.markdown.fence', () =>
          ctx.slots.register(
            {
              name: 'conversation.chat.markdown.fence',
              id: 'dsh-cards-fence',
              order: 5,
              locale: NS,
            },
            FenceCard,
          ),
        )
      } catch (error) {
        console.error('[dsh-cards] блоки кода недоступны:', error)
      }
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    exports.NS = NS
    exports.parseCard = parseCard
    return module.exports
  },
})
