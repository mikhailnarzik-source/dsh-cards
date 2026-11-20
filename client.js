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
    function CardView({ card }) {
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
        card.note !== '' ? h('span', { style: { fontSize: 12, opacity: 0.7 } }, card.note) : null,
      )
    }

    /** Рендерер блока кода ```dsh-card. */
    function FenceCard(props) {
      const language = props?.language ?? props?.lang ?? props?.info ?? ''
      if (String(language).trim() !== LANGUAGE) return null
      const content = props?.content ?? props?.code ?? props?.text ?? props?.value ?? ''
      const parsed = parseCard(String(content))
      if (!parsed.ok) return null
      return h(CardView, { card: parsed.card })
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
          h('button', { style: { ...S.button, marginLeft: 'auto', flex: '0 0 auto' }, onClick: () => setOpen(true) }, t('open')),
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
          h('button', { style: S.button, onClick: () => setOpen(false) }, t('collapse')),
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
            CardsCard,
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
