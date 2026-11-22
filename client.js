/**
 * Browser half of `dsh-cards`.
 *
 * Три места:
 *  - панель в левой меню (`main` + `sidebar.panellist`, ключ `plugin-cards`):
 *    та же страница настроек без страницы плагин-менеджера;
 *  - страница плагина: формат блока и живой предпросмотр в едином стиле;
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
    /**
     * Панель в левой панели: ключ `main` и id строки `sidebar.panellist`
     * совпадают (`plugin-cards`) — хост открывает страницу по этому id.
     * `PANEL_ORDER` — позиция в общем списке панелей «Оформления интерфейса»
     * (20 + индекс: карточки 0, сжатие 1, ревью 2, …).
     */
    const PANEL_ID = 'plugin-cards'
    const PANEL_EMOJI = '🧩'
    const PANEL_ORDER = 20
    /**
     * id плагина в состоянии видимости панелей: его ведёт «Оформление
     * интерфейса» (`dsh-polish`) в localStorage. Пока состояния нет или оно
     * битое, панель считаем закреплённой — так же, как в настройках оформления.
     */
    const PANEL_STATE_ID = 'cards'
    const PANEL_STATE_KEY = 'dsh-polish:panel-visibility'
    const PANELS_CHANGED_EVENT = 'dsh-polish:panels-changed'

    // Тона карточки — только токены темы DSH: полоса слева подстраивается под тему.
    const TONES = {
      info: 'var(--dsw-alias-brand-primary)',
      success: 'var(--dsw-alias-state-success-primary)',
      warning: 'var(--dsw-alias-state-warn-primary)',
      danger: 'var(--dsw-alias-state-error-primary)',
    }

    const en = {
      title: 'Cards',
      panelSubtitle: 'Block format and a live preview.',
      heading: 'Cards in answers',
      hint: 'Скопируйте пример ниже и вставьте его в сообщение ассистенту или в свой ответ — блок превратится в карточку.',
      example: 'Example',
      preview: 'Preview',
      broken: 'Could not read the block',
      open: 'Open',
      collapse: 'Collapse',
      copy: 'Copy example',
      copied: 'Copied — paste it into a message',
      statusReady: 'Ready',
      statusBroken: 'Error',
      brokenHint: 'Expected a JSON object with title, rows, list and note.',
      refresh: 'Refresh',
    }
    const ru = {
      title: 'Карточки',
      panelSubtitle: 'Формат блока и живой предпросмотр.',
      heading: 'Карточки в ответах',
      hint: 'Скопируйте пример ниже и вставьте его в сообщение ассистенту или в свой ответ — блок превратится в карточку.',
      example: 'Пример',
      preview: 'Предпросмотр',
      broken: 'Не удалось прочитать блок',
      open: 'Открыть',
      collapse: 'Свернуть',
      copy: 'Скопировать пример',
      copied: 'Скопировано — вставьте в сообщение',
      statusReady: 'Разбирается',
      statusBroken: 'Ошибка',
      brokenHint: 'Ожидается объект JSON с полями title, rows, list и note.',
      refresh: 'Обновить',
    }

    /**
     * Единая система кнопок плагина (спека `.tools/plugin-design-spec-v2.md`):
     * высота 36 px (маленькие в шапке — 32), padding 0 14, радиус 10,
     * шрифт 600 12.5, ширина — по тексту. Все варианты — только токены темы.
     *
     * primary — мягкая заливка brand + текст brand. Белый фон с белым текстом
     * запрещён: в тёмной теме brand-primary сам белый, поэтому старые
     * `button-primary-fill` + `label-primary-inverted` давали нечитаемый текст.
     */
    const BTN_BASE = {
      boxSizing: 'border-box',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 36,
      padding: '0 14px',
      borderRadius: 10,
      fontFamily: 'inherit',
      fontSize: 12.5,
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      transition: 'background-color .14s ease, border-color .14s ease, color .14s ease',
    }
    const BTN = {
      base: BTN_BASE,
      primary: {
        ...BTN_BASE,
        border: '1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent)',
        background: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent)',
        color: 'var(--dsw-alias-brand-primary)',
      },
      secondary: {
        ...BTN_BASE,
        border: '1px solid var(--dsw-alias-border-l4)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
      },
      danger: {
        ...BTN_BASE,
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 50%, transparent)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent)',
        color: 'var(--dsw-alias-state-error-primary)',
      },
      small: { ...BTN_BASE, height: 32, padding: '0 12px' },
      icon: {
        ...BTN_BASE,
        width: 32,
        height: 32,
        padding: 0,
        border: '1px solid var(--dsw-alias-border-l4)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
      },
    }

    /**
     * Статус-чип — та же система, что кнопки (спека v2): height 32, радиус 10,
     * padding 0 12, border 1px, шрифт 600 12.5, inline-flex gap 6. Фон и рамка —
     * мягкая заливка токеном по смыслу (success/warn/error/brand), текст — тем же
     * токеном, поэтому точка-индикатор 6px слева красится `currentColor`.
     */
    const CHIP_BASE = {
      boxSizing: 'border-box',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 32,
      padding: '0 12px',
      borderRadius: 10,
      border: '1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent)',
      background: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent)',
      color: 'var(--dsw-alias-brand-primary)',
      fontSize: 12.5,
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      flex: '0 0 auto',
      minWidth: 0,
    }
    const CHIP_TONES = {
      brand: {},
      ok: {
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 55%, transparent)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent)',
        color: 'var(--dsw-alias-state-success-primary)',
      },
      warn: {
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, transparent)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent)',
        color: 'var(--dsw-alias-state-warn-primary)',
      },
      error: {
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent)',
        color: 'var(--dsw-alias-state-error-primary)',
      },
      muted: {
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)',
        color: 'var(--dsw-alias-label-secondary)',
      },
    }
    const chipStyle = (tone) => ({ ...CHIP_BASE, ...(CHIP_TONES[tone] ?? CHIP_TONES.brand) })
    /** Точка-индикатор чипа: 6px, цвет наследует текст чипа. */
    const CHIP_DOT = { boxSizing: 'border-box', width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flex: '0 0 auto' }

    /**
     * Страница плагина в едином стиле DSH: контент по центру (maxWidth 960),
     * шапка с иконкой и статусом, карточки-секции, адаптив в одну колонку.
     * Цвета — только токены темы; жёстких hex нет.
     */
    const UI = {
      page: {
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: 960,
        margin: '0 auto',
        padding: '24px 28px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontSize: 13,
        lineHeight: 1.55,
        color: 'var(--dsw-alias-label-primary)',
        flex: '1 1 auto',
        minHeight: 0,
        maxHeight: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
      },
      body: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
      head: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
      icon: {
        boxSizing: 'border-box',
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 52,
        height: 52,
        borderRadius: 14,
        fontSize: 26,
        lineHeight: 1,
        background: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent)',
        border: '1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent)',
      },
      headText: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: '1 1 240px' },
      title: { margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.25, color: 'var(--dsw-alias-label-primary)' },
      subtitle: {
        margin: 0,
        fontSize: 12.5,
        fontWeight: 400,
        lineHeight: 1.5,
        color: 'var(--dsw-alias-label-secondary)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      },
      headRight: { display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flex: '0 0 auto', flexWrap: 'wrap', minWidth: 0 },
      refresh: { ...BTN.secondary, height: 32 },
      iconButton: { ...BTN.icon },
      card: {
        boxSizing: 'border-box',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderRadius: 14,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      sectionHead: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
      bar: { flex: '0 0 auto', width: 3, height: 14, borderRadius: 2, background: 'var(--dsw-alias-brand-primary)' },
      sectionTitle: { margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: 'var(--dsw-alias-label-primary)' },
      grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        gap: 16,
        alignItems: 'stretch',
        minWidth: 0,
      },
      field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
      label: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-secondary)' },
      hint: { fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)', overflowWrap: 'anywhere' },
      area: {
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 160,
        padding: '10px 12px',
        borderRadius: 9,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        lineHeight: 1.5,
        resize: 'vertical',
      },
      primary: { ...BTN.primary },
      secondary: { ...BTN.secondary },
      empty: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flex: '1 1 auto',
        minWidth: 0,
        padding: '28px 12px',
        textAlign: 'center',
      },
      emptyText: { fontSize: 12.5, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' },
    }

    /** CSS, который нельзя задать inline: наведение, фокус, disabled и адаптив. */
    const PAGE_CSS = [
      // Сетка карточек: auto-fit, одна колонка на узком экране, одной высоты.
      '.dshc-page-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));align-items:stretch;}',
      // Кнопки — единая система: ширина по тексту, мягкие заливки из токенов.
      '.dshc-page-primary,.dshc-page-button,.dshc-page-refresh,.dshc-page-icon,.dshc-page-chip{flex:0 0 auto;min-width:0;}',
      '.dshc-page-primary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent) !important;}',
      '.dshc-page-button:hover:not(:disabled),.dshc-page-refresh:hover:not(:disabled),.dshc-page-icon:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover) !important;}',
      '.dshc-page-primary:active:not(:disabled),.dshc-page-button:active:not(:disabled){transform:translateY(1px);}',
      '.dshc-page-field:focus-visible,.dshc-page-primary:focus-visible,.dshc-page-button:focus-visible,.dshc-page-refresh:focus-visible,.dshc-page-icon:focus-visible{outline:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent);outline-offset:1px;}',
      '.dshc-page-primary:disabled,.dshc-page-button:disabled,.dshc-page-refresh:disabled{opacity:.55;cursor:default;}',
      // Адаптив: длинные строки переносятся, кнопки — в одну строку по тексту.
      '.dshc-page{overflow-wrap:anywhere;box-sizing:border-box;width:100%;min-width:0;min-height:0;max-height:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin;padding-bottom:40px;}',
      '.dshc-page-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;margin-top:auto;}',
      '@media (max-width: 900px){.dshc-page{padding:20px 18px 36px !important;}.dshc-page-grid{grid-template-columns:1fr !important;}}',
      '@media (max-width: 640px){.dshc-page{padding:16px 14px 28px !important;}.dshc-page-head{gap:10px;}.dshc-page-head-right{flex:1 1 100%;margin-left:0;}}',
    ].join('\n')

    let translate = (key) => key

    /** Разобрать блок; при ошибке — понятная причина. */
    /** Кнопка-шеврон: свернуть страницу до шапки или развернуть обратно. */
    function ToggleIcon({ open, onClick }) {
      return h(
        'button',
        {
          type: 'button',
          onClick,
          title: open ? translate('collapse') : translate('open'),
          'aria-label': open ? translate('collapse') : translate('open'),
          'aria-expanded': open ? 'true' : 'false',
          className: 'dshc-page-icon',
          style: UI.iconButton,
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

    /**
     * Строки карточки «ключ — значение».
     *
     * Раньше строки были flex-парой без min-width: ключ рвался посередине
     * («Расходы» → «Расход» / «ы»), потому что родитель карточки наследовал
     * `overflow-wrap:anywhere` из страницы и из markdown-ответа. Теперь строки —
     * grid `minmax(92px,max-content) minmax(0,1fr)` с gap 12:
     *  - ключ не рвётся (`overflow-wrap:normal; word-break:normal; hyphens:auto`),
     *  - значение переносится по словам, а неразрывные токены (URL, пути) —
     *    по `overflow-wrap:anywhere`,
     *  - в узком контейнере (< 360 px) строка становится двухстрочной:
     *    ключ сверху, значение снизу (container query).
     * Ничего не выходит за карточку: у всех детей `min-width:0`.
     */
    const CARD_STYLES = [
      '.dshc-card {',
      '  box-sizing: border-box;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 8px;',
      '  min-width: 0;',
      '  max-width: 100%;',
      '  overflow-wrap: anywhere;',
      '  word-break: normal;',
      '  container-type: inline-size;',
      '  container-name: dshc-card;',
      '}',
      '.dshc-card-title { min-width: 0; font-weight: 600; font-size: 13.5px; overflow-wrap: anywhere; }',
      '.dshc-card-subtitle { min-width: 0; font-size: 12px; opacity: .75; overflow-wrap: anywhere; }',
      '.dshc-card-note { min-width: 0; font-size: 12px; opacity: .7; overflow-wrap: anywhere; }',
      '.dshc-rows { display: flex; flex-direction: column; gap: 4px; min-width: 0; max-width: 100%; }',
      '.dshc-row { display: grid; grid-template-columns: minmax(92px, max-content) minmax(0, 1fr); gap: 12px; align-items: baseline; min-width: 0; max-width: 100%; }',
      '.dshc-row-key { min-width: 0; overflow-wrap: normal; word-break: normal; hyphens: auto; opacity: .75; }',
      '.dshc-row-value { min-width: 0; overflow-wrap: anywhere; word-break: normal; hyphens: auto; font-weight: 600; text-align: right; }',
      '.dshc-list { display: flex; flex-direction: column; gap: 3px; min-width: 0; }',
      '.dshc-list-item { display: flex; gap: 8px; min-width: 0; }',
      '.dshc-list-mark { flex: 0 0 auto; opacity: .5; }',
      '.dshc-list-text { min-width: 0; overflow-wrap: anywhere; }',
      '@container dshc-card (max-width: 360px) {',
      '  .dshc-row { grid-template-columns: minmax(0, 1fr); gap: 2px; }',
      '  .dshc-row-value { text-align: left; }',
      '}',
    ].join('\n')

    /** Сама карточка: используется и в предпросмотре, и в ответе ассистента. */
    function CardView({ card, actions, copyText, detailText }) {
      return h(
        'div',
        {
          className: 'dshc-card',
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
            minWidth: 0,
            maxWidth: '100%',
            boxSizing: 'border-box',
          },
        },
        h('style', { key: 'card-css' }, CARD_STYLES),
        card.title !== '' ? h('span', { className: 'dshc-card-title' }, card.title) : null,
        card.subtitle !== '' ? h('span', { className: 'dshc-card-subtitle' }, card.subtitle) : null,
        card.rows.length > 0
          ? h(
              'div',
              { className: 'dshc-rows' },
              ...card.rows.map((row, index) =>
                h(
                  'div',
                  { key: index, className: 'dshc-row' },
                  h('span', { className: 'dshc-row-key' }, row.label),
                  h('span', { className: 'dshc-row-value' }, row.value),
                ),
              ),
            )
          : null,
        card.list.length > 0
          ? h(
              'div',
              { className: 'dshc-list' },
              ...card.list.map((item, index) =>
                h(
                  'div',
                  { key: index, className: 'dshc-list-item' },
                  h('span', { className: 'dshc-list-mark' }, '•'),
                  h('span', { className: 'dshc-list-text' }, item),
                ),
              ),
            )
          : null,
        typeof detailText === 'string' && detailText !== ''
          ? h(
              'pre',
              {
                style: {
                  margin: '2px 0 0',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(128,128,128,0.22)',
                  background: 'rgba(0,0,0,0.12)',
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  userSelect: 'all',
                  maxWidth: '100%',
                },
              },
              detailText,
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
        card.note !== '' ? h('span', { className: 'dshc-card-note' }, card.note) : null,
        (Array.isArray(actions) && actions.length > 0) || (typeof copyText === 'string' && copyText !== '')
          ? h(CardActions, { actions, copyText })
          : null,
)
    }

    /** Рендерер блока кода ```dsh-card. */
    /** Стили кнопок карточки: та же единая система, что и на странице. */
    const ACTION_STYLES = [
      '.dshc-actions {',
      '  display: flex;',
      '  align-items: center;',
      '  flex-wrap: wrap;',
      '  gap: 8px;',
      '  min-width: 0;',
      '  max-width: 100%;',
      '  margin-top: 12px;',
      '}',
      '.dshc-action {',
      '  flex: 0 0 auto;',
      '  box-sizing: border-box;',
      '  white-space: nowrap;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 6px;',
      '  height: 36px;',
      '  padding: 0 14px;',
      '  border-radius: 10px;',
      '  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);',
      '  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);',
      '  color: var(--dsw-alias-brand-primary);',
      '  font: inherit;',
      '  font-size: 12.5px;',
      '  font-weight: 600;',
      '  line-height: 1;',
      '  cursor: pointer;',
      '  transition: background .14s ease, border-color .14s ease, transform .08s ease;',
      '}',
      '.dshc-action:hover:not(:disabled) {',
      '  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent);',
      '}',
      '.dshc-action:active:not(:disabled) { transform: translateY(1px); }',
      '.dshc-action:disabled { opacity: .55; cursor: default; }',
      '.dshc-action:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent); outline-offset: 1px; }',
      '.dshc-split-main { border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important; }',
      '.dshc-chevron { border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important; border-left-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 25%, transparent) !important; min-width: 32px; padding: 0 8px !important; margin-left: -8px; }',
      '.dshc-menu { display: flex; flex-direction: column; gap: 1px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-2); box-shadow: 0 10px 28px rgba(0,0,0,0.35); }',
      '.dshc-menu-item { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12.5px; font-weight: 400; text-align: left; cursor: pointer; }',
      '.dshc-menu-item:hover { background: var(--dsw-alias-interactive-bg-hover); }',
      '.dshc-menu-item:active { background: var(--dsw-alias-interactive-bg-active); }',
      '.dshc-menu-sep { height: 1px; margin: 3px 6px; background: var(--dsw-alias-border-l2); }',
      '.dshc-menu-item span { min-width: 0; overflow-wrap: anywhere; }',
      '.dshc-corner { margin-left: auto; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 3px; height: 32px; padding: 0 8px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l4); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12.5px; font-weight: 600; line-height: 1; white-space: nowrap; cursor: pointer; }',
      '.dshc-corner:hover { background: var(--dsw-alias-interactive-bg-hover); }',
      '.dshc-corner:focus-visible { outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent); outline-offset: 1px; }',
    ].join('\n')

    /** Отправить действие в host и вернуть признак успеха. */
    async function sendAction(action) {
      try {
        const response = await fetch('/api/dsh-cards/action', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: action.kind, target: action.target, plugin: action.plugin, name: action.name, editor: action.editor }),
        })
        const data = await response.json()
        return data?.ok === true
      } catch {
        return false
      }
    }

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
      const [state, setState] = React.useState({ busy: '', note: '', result: {}, error: '', editor: null, appsData: null })
      const [lastEditor, setLastEditor] = React.useState(null)
      const results = state.result ?? {}
      const [copied, setCopied] = React.useState(false)
      const ACTIONS_PATH = '/api/dsh-cards/action'
      // Цвет результата только у действий, которые что-то выполняют.
      const COLORED_KINDS = ['git-push', 'git-pull', 'run-tests', 'dsh-plugin-add', 'dsh-plugin-update']

      // Показываем в подписи последний выбранный редактор (до перезапуска DSH).
      React.useEffect(() => {
        let cancelled = false
        void (async () => {
          try {
            const response = await fetch(ACTIONS_PATH, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ kind: 'list-editors' }),
            })
            const data = await response.json()
            if (!cancelled && data?.last) setLastEditor(data.last)
          } catch {
            // без последнего выбора работаем как обычно
          }
        })()
        return () => { cancelled = true }
      }, [])

      /** Загрузить системный список приложений для файла. */
      const loadApps = async (action) => {
        if (state.appsData !== null) return state.appsData
        try {
          const response = await fetch(ACTIONS_PATH, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: 'list-editors', target: action.target }),
          })
          const data = await response.json()
          const value = {
            defaultApp: data?.defaultApp ?? null,
            editors: Array.isArray(data?.editors) ? data.editors : [],
            apps: Array.isArray(data?.apps) ? data.apps : [],
          }
          setState((previous) => ({ ...(previous ?? {}), appsData: value }))
          return value
        } catch {
          return null
        }
      }

      /** Открыть меню выбора приложения для файла. */
      const openEditorMenu = async (action) => {
        if (state.editor !== null && state.editor !== undefined && state.editor.action?.label === action.label) {
          setState((previous) => ({ ...(previous ?? {}), editor: null }))
          return
        }
        setState((previous) => ({ ...(previous ?? {}), busy: action.label }))
        const data = await loadApps(action)
        if (data === null) {
          setState((previous) => ({ ...(previous ?? {}), busy: '', error: 'список приложений недоступен' }))
          return
        }
        setState((previous) => ({ ...(previous ?? {}), busy: '', editor: { action, ...data } }))
      }

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
          setState((previous) => ({ ...(previous ?? {}), busy: '', note: '' }))
          if (copied) setTimeout(() => setCopied(false), 1600)
          return
        }
        // «Открыть с помощью»: показываем меню как в Windows.
        if (action.kind === 'open-in-editor') {
          await openEditorMenu(action)
          return
        }
        try {
          const response = await fetch(ACTIONS_PATH, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: action.kind, target: action.target, plugin: action.plugin, name: action.name, editor: action.editor }),
          })
          const data = await response.json()
          if (COLORED_KINDS.includes(action.kind) && data?.ok !== true) {
            const reason = [data?.message, String(data?.output ?? '').trim().split(String.fromCharCode(10))[0]].filter(Boolean).join(': ')
            setState((previous) => ({ ...(previous ?? {}), busy: '', note: '', error: reason, result: { ...((previous ?? {}).result ?? {}), [action.label]: false } }))
            return
          }
          if (COLORED_KINDS.includes(action.kind) && data?.ok === true) {
            setState((previous) => ({ ...(previous ?? {}), busy: '', note: '', result: { ...((previous ?? {}).result ?? {}), [action.label]: true } }))
          } else if (COLORED_KINDS.includes(action.kind)) {
            setState((previous) => ({ ...(previous ?? {}), busy: '', note: '', result: { ...((previous ?? {}).result ?? {}), [action.label]: false } }))
          } else {
            setState((previous) => ({ ...(previous ?? {}), busy: '', note: '' }))
          }
        } catch {
          if (COLORED_KINDS.includes(action.kind)) {
            setState((previous) => ({ ...(previous ?? {}), busy: '', note: '', result: { ...((previous ?? {}).result ?? {}), [action.label]: false } }))
          } else {
            setState((previous) => ({ ...(previous ?? {}), busy: '', note: '' }))
          }
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
        { style: { position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 } },
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
              overflow: 'visible',
              paddingRight: 36,
            },
          },
          ...actions
            .filter((action) => action.kind !== 'open-in-editor')
            .map((action) => {
              const colored = COLORED_KINDS.includes(action.kind)
              return h(
                'button',
                {
                  key: action.label,
                  type: 'button',
                  className: 'dshc-action',
                  disabled: state.busy !== '',
                  onClick: () => void run(action),
                  style: colored && results[action.label] === true
                    ? { background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 38%, transparent)', borderColor: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 80%, transparent)', color: 'var(--dsw-alias-state-success-primary)', cursor: 'default' }
                    : colored && results[action.label] === false
                      ? { background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 34%, transparent)', borderColor: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 80%, transparent)', color: 'var(--dsw-alias-state-error-primary)' }
                      : undefined,
                },
                state.busy === action.label
                  ? 'выполняю…'
                  : colored && results[action.label] === true
                    ? action.label + ' снова'
                    : action.label,
              )
            }),
          actions.some((action) => action.kind === 'open-in-editor')
            ? h(
                'button',
                {
                  type: 'button',
                  title: 'Открыть с помощью…',
                  className: 'dshc-corner',
                  onClick: () => {
                    const action = actions.find((item) => item.kind === 'open-in-editor')
                    if (action !== undefined) void openEditorMenu(action)
                  },
                },
                state.appsData?.defaultApp?.icon
                  ? h('img', { src: state.appsData.defaultApp.icon, width: 16, height: 16, alt: '', style: { width: 16, height: 16, borderRadius: 3 } })
                  : h('span', { style: { fontSize: 13 } }, '📄'),
                h('span', { style: { fontSize: 9, opacity: 0.8, lineHeight: 1 } }, '▾'),
              )
            : null,
          copyText === '' || actions.some((item) => item.kind === 'copy')
            ? null
            : h(
                'button',
                { type: 'button', className: 'dshc-action', onClick: () => void copy() },
                copied ? 'Скопировано' : 'Копировать команду',
              ),
        state.editor !== null && state.editor !== undefined
          ? h(
              'div',
              {
                className: 'dshc-menu',
                style: { position: 'absolute', right: 0, bottom: 38, width: 'min(300px, 100%)', maxHeight: 380, overflowY: 'auto', overflowX: 'hidden', marginTop: 0, padding: 6, borderRadius: 12, zIndex: 60 },
              },
              state.editor.defaultApp !== null && state.editor.defaultApp !== undefined
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dshc-menu-item',
                      onClick: async () => {
                        const opened = await sendAction({ kind: 'open-file', target: state.editor.action.target })
                        setState((previous) => ({ ...(previous ?? {}), editor: null, error: opened ? '' : 'не удалось открыть файл' }))
                      },
                    },
                    state.editor.defaultApp.icon
                      ? h('img', { src: state.editor.defaultApp.icon, width: 18, height: 18, alt: '', style: { width: 18, height: 18, borderRadius: 3 } })
                      : h('span', { style: { width: 18 } }),
                    h('span', null, state.editor.defaultApp.name + ' (по умолчанию)'),
                  )
                : null,
              ...(state.editor.editors ?? []).map((editor) =>
                h(
                  'button',
                  {
                    key: 'editor-' + editor.id,
                    type: 'button',
                    className: 'dshc-menu-item',
                    onClick: async () => {
                      const opened = await sendAction({ ...state.editor.action, editor: editor.id })
                      setState((previous) => ({ ...(previous ?? {}), editor: null, result: { ...((previous ?? {}).result ?? {}), [state.editor.action.label]: opened }, error: opened ? '' : 'не удалось открыть в ' + editor.name }))
                    },
                  },
                  editor.icon
                    ? h('img', { src: editor.icon, width: 18, height: 18, alt: '', style: { width: 18, height: 18, borderRadius: 3 } })
                    : h('span', { style: { width: 18 } }),
                  h('span', null, editor.name),
                ),
              ),
              ...(state.editor.apps ?? [])
                .filter((app) => {
                  const name = String(app.name ?? '').toLowerCase()
                  if (name === '') return false
                  if (name === String(state.editor.defaultApp?.name ?? '').toLowerCase()) return false
                  return !(state.editor.editors ?? []).some((editor) => String(editor.name ?? '').toLowerCase() === name)
                })
                .map((app) =>
                h(
                  'button',
                  {
                    key: 'app-' + app.path,
                    type: 'button',
                    className: 'dshc-menu-item',
                    onClick: async () => {
                      const opened = await sendAction({ kind: 'open-with', target: state.editor.action.target, app: app.path })
                      setState((previous) => ({ ...(previous ?? {}), editor: null, error: opened ? '' : 'не удалось открыть в ' + app.name }))
                    },
                  },
                  app.icon
                    ? h('img', { src: app.icon, width: 18, height: 18, alt: '', style: { width: 18, height: 18, borderRadius: 3 } })
                    : h('span', { style: { width: 18 } }),
                  h('span', null, app.name),
                ),
              ),
              h('div', { className: 'dshc-menu-sep' }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshc-menu-item',
                  onClick: async () => {
                    const chosen = await sendAction({ kind: 'pick-editor' })
                    if (chosen === false) {
                      setState((previous) => ({ ...(previous ?? {}), editor: null, error: 'программа не выбрана' }))
                      return
                    }
                    const opened = await sendAction({ ...state.editor.action })
                    setState((previous) => ({ ...(previous ?? {}), editor: null, error: opened ? '' : 'не удалось открыть выбранной программой' }))
                  },
                },
                h('span', { style: { width: 18, textAlign: 'center', opacity: 0.75 } }, '…'),
                h('span', null, 'Указать программу…'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshc-menu-item',
                  onClick: async () => {
                    const opened = await sendAction({ kind: 'reveal-file', target: state.editor.action.target })
                    setState((previous) => ({ ...(previous ?? {}), editor: null, error: opened ? '' : 'не удалось показать файл в папке' }))
                  },
                },
                h('span', { style: { width: 18, textAlign: 'center', opacity: 0.75 } }, '📁'),
                h('span', null, 'Показать в папке'),
              ),
            )
          : null,
        state.error !== '' && state.error !== undefined
          ? h(
              'span',
              { style: { fontSize: 12, color: 'var(--dsw-alias-state-error-primary)', lineHeight: 1.4, overflowWrap: 'anywhere' } },
              state.error,
            )
          : null,
        ),

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
      const baseName = (value) => String(value).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || value
      if (typeof raw.file === 'string' && raw.file !== '') {
        const name = baseName(raw.file)
        actions.push({ label: 'Открыть файл', kind: 'open-file', target: raw.file })
        actions.push({ label: 'Сохранить как…', kind: 'save-as', target: raw.file })
        actions.push({ label: 'Открыть с помощью', kind: 'open-in-editor', target: raw.file })
      }
      if (typeof raw.url === 'string' && raw.url !== '') {
        let host = raw.url
        try { host = new URL(raw.url).host + new URL(raw.url).pathname } catch { host = raw.url }
        actions.push({ label: 'Открыть ссылку', kind: 'open-url', target: raw.url })
        if (raw.download !== false) {
          const fileName = typeof raw.name === 'string' && raw.name !== '' ? raw.name : baseName(raw.url)
          actions.push({ label: 'Скачать файл', kind: 'download-file', target: raw.url, name: fileName })
        }
      }
      for (const item of Array.isArray(raw.actions) ? raw.actions : []) {
        if (item !== null && typeof item === 'object' && typeof item.label === 'string') {
          actions.push({
            label: item.label,
            kind: typeof item.kind === 'string' ? item.kind : '',
            target: typeof item.target === 'string' ? item.target : '',
            plugin: typeof item.plugin === 'string' ? item.plugin : '',
            name: typeof item.name === 'string' ? item.name : '',
            editor: typeof item.editor === 'string' ? item.editor : '',
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
      const copyText = copyLines.join('\n')
      const detailLines = []
      if (typeof raw.file === 'string' && raw.file !== '') detailLines.push('Файл: ' + raw.file)
      if (typeof raw.url === 'string' && raw.url !== '') detailLines.push('Ссылка: ' + raw.url)
      if (typeof raw.folder === 'string' && raw.folder !== '') detailLines.push('Папка: ' + raw.folder)
      const detailText = detailLines.join('\n')

      return h(CardView, { card: parsed.card, actions, copyText, detailText })
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

    /** Шапка страницы: квадрат с иконкой, заголовок, статус-чип и «Обновить». */
    function PageHeader({ icon, title, subtitle, chipLabel, chipTone, refreshLabel, onRefresh, open, onToggle }) {
      return h(
        'div',
        { className: 'dshc-page-head', style: UI.head },
        h('div', { style: UI.icon }, icon),
        h(
          'div',
          { style: UI.headText },
          h('h1', { style: UI.title }, title),
          subtitle !== '' ? h('p', { style: UI.subtitle }, subtitle) : null,
        ),
        h(
          'div',
          { className: 'dshc-page-head-right', style: UI.headRight },
          h(
            'span',
            { className: 'dshc-page-chip', style: chipStyle(chipTone), 'data-dsh-cards-chip': 'status', role: 'status' },
            h('span', { style: CHIP_DOT }),
            chipLabel,
          ),
          h(
            'button',
            { type: 'button', className: 'dshc-page-refresh', style: UI.refresh, onClick: onRefresh },
            refreshLabel,
          ),
          onToggle === undefined ? null : h(ToggleIcon, { open, onClick: onToggle }),
        ),
      )
    }

    /** Карточка-секция: акцентная полоска, заголовок 14/600 и содержимое. */
    function SectionCard({ title, children }) {
      return h(
        'section',
        { style: UI.card },
        h('div', { style: UI.sectionHead }, h('span', { style: UI.bar }), h('h2', { style: UI.sectionTitle }, title)),
        children,
      )
    }

    /**
     * Страница настроек: на странице плагина рисует себя целиком (шапка, карточки),
     * а в панели левого меню — только содержимое (`bare`), потому что шапку и
     * отступы даёт `CardsPanelPage`.
     */
    function CardsCard(props) {
      const bare = props?.bare === true
      const t = (key) => translate(key)
      const [open, setOpen] = React.useState(true)
      const [text, setText] = React.useState(EXAMPLE)
      const [notice, setNotice] = React.useState('')

      const parsed = parseCard(text)
      const chipTone = parsed.ok ? 'ok' : 'error'

      const copyExample = async () => {
        try {
          await navigator.clipboard.writeText('\u0060\u0060\u0060dsh-card\n' + text + '\n\u0060\u0060\u0060')
          setNotice(t('copied'))
        } catch {
          setNotice(t('copied'))
        }
      }

      const blocks = bare
        ? []
        : [
            h('style', { key: 'page-css' }, PAGE_CSS),
            h(PageHeader, {
              key: 'page-head',
              icon: '🧩',
              title: t('heading'),
              subtitle: t('hint'),
              chipLabel: parsed.ok ? t('statusReady') : t('statusBroken'),
              chipTone,
              refreshLabel: t('refresh'),
              onRefresh: () => {
                setText(EXAMPLE)
                setNotice('')
              },
              open,
              onToggle: () => setOpen(!open),
            }),
          ]

      if (open) {
        blocks.push(
          h(
            'div',
            { key: 'page-grid', className: 'dshc-page-grid', style: UI.grid },
            h(
              SectionCard,
              { key: 'example', title: t('example') },
              h('textarea', {
                className: 'dshc-page-field',
                style: UI.area,
                value: text,
                onChange: (event) => {
                  setText(event.target.value)
                  setNotice('')
                },
              }),
              h(
                'div',
                { className: 'dshc-page-actions' },
                h(
                  'button',
                  { type: 'button', className: 'dshc-page-primary', style: UI.primary, onClick: () => void copyExample() },
                  t('copy'),
                ),
                notice !== '' ? h('span', { style: UI.hint }, notice) : null,
              ),
            ),
            h(
              SectionCard,
              { key: 'preview', title: t('preview') },
              parsed.ok
                ? h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0 } },
                    h(CardView, { card: parsed.card }),
                  )
                : h(
                    'div',
                    { style: UI.empty },
                    h('span', { style: { fontSize: 32, lineHeight: 1 } }, '⚠️'),
                    h('span', { style: UI.emptyText }, `${t('broken')}: ${parsed.reason}`),
                    h('span', { style: UI.hint }, t('brokenHint')),
                  ),
            ),
          ),
        )
      }

      return h(
        'div',
        bare
          ? { className: 'dshc-page-body', style: UI.body }
          : { className: 'dshc-page', style: UI.page },
        blocks,
      )
    }

    /** Заголовок панели: эмодзи-иконка, название плагина и короткий подзаголовок. */
    function PanelHeader() {
      return h(
        'div',
        { className: 'dshc-panel-head', style: UI.head },
        h('span', { style: UI.icon, 'aria-hidden': 'true' }, PANEL_EMOJI),
        h(
          'div',
          { style: UI.headText },
          h('h1', { style: UI.title }, translate('title')),
          h('p', { style: UI.subtitle }, translate('panelSubtitle')),
        ),
      )
    }

    /**
     * Главная панель плагина: та же страница настроек в центрированной колонке
     * (maxWidth 960), но без страницы плагин-менеджера — только шапка плагина и
     * его элементы управления.
     */
    function CardsPanelPage() {
      return h(
        'section',
        { className: 'dshc-page', style: UI.page, 'aria-label': translate('title'), 'data-dsh-panel': PANEL_ID },
        h('style', { key: 'page-css' }, PAGE_CSS),
        h(PanelHeader, { key: 'panel-head' }),
        h(CardsCard, { key: 'settings', bare: true }),
      )
    }

    /** Иконка строки левой панели: эмодзи в размер, который просит хост. */
    function PanelIcon(props) {
      const requested = Number(props?.size)
      const size = Number.isFinite(requested) && requested > 0 ? requested : 16
      return h(
        'span',
        {
          'data-dsh-panel-icon': PANEL_STATE_ID,
          'aria-hidden': true,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
            fontSize: Math.round(size * 0.95),
            lineHeight: 1,
          },
        },
        PANEL_EMOJI,
      )
    }

    /** Закреплена ли панель: состояние ведёт «Оформление интерфейса» (dsh-polish). */
    function isPanelPinned() {
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return true
        const raw = localStorage.getItem(PANEL_STATE_KEY)
        // Пока оформление не сохраняло состояние, все панели видны и закреплены.
        if (raw === null || raw === '') return true
        const state = JSON.parse(raw)
        if (!Array.isArray(state?.pinned)) return true
        return state.pinned.includes(PANEL_STATE_ID) || state.pinned.includes(PANEL_ID)
      } catch {
        return true
      }
    }

    /**
     * Панель в левой панели: `main` регистрируется всегда (она есть и в меню
     * «Ещё»), строка `sidebar.panellist` — только когда панель закреплена.
     * Событие `dsh-polish:panels-changed` приходит из «Оформления интерфейса»
     * после закрепления/открепления: перечитываем состояние и перерегистрируем
     * строку, сняв прошлую регистрацию.
     */
    function registerPanels(ctx) {
      try {
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID }, CardsPanelPage),
        )
      } catch (error) {
        console.error('[dsh-cards] панель в левом меню недоступна:', error)
      }

      let disposeSidebar = null
      const syncSidebar = () => {
        if (typeof disposeSidebar === 'function') {
          try {
            disposeSidebar()
          } catch (error) {
            console.error('[dsh-cards] не удалось снять строку левой панели:', error)
          }
          disposeSidebar = null
        }
        if (!isPanelPinned()) return
        try {
          let dispose = null
          const outer = ctx.slots.inject('sidebar.panellist', () => {
            dispose = ctx.slots.register(
              {
                name: 'sidebar.panellist',
                id: PANEL_ID,
                order: PANEL_ORDER,
                label: () => translate('title'),
                locale: NS,
              },
              PanelIcon,
            )
            return dispose
          })
          disposeSidebar = typeof dispose === 'function' ? dispose : outer
        } catch (error) {
          disposeSidebar = null
          console.error('[dsh-cards] строка в левой панели недоступна:', error)
        }
      }
      syncSidebar()

      try {
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener(PANELS_CHANGED_EVENT, syncSidebar)
        }
      } catch (error) {
        console.error('[dsh-cards] событие панелей недоступно:', error)
      }
    }

    /** Большой предпросмотр с редактором — только на странице своего плагина. */
    function DetailSection(props) {
      const subject = props?.subject
      const packageName =
        subject?.kind === 'bundle' && typeof subject?.pkg?.name === 'string'
          ? subject.pkg.name
          : typeof subject?.id === 'string'
            ? subject.id
            : ''
      if (packageName !== 'dsh-cards') return null
      return h(CardsCard)
    }

    function apply(ctx) {
      ctx.locale.register(NS, { en, ru })
      translate = ctx.locale.bind(NS)

      // Панель в левом меню: main — всегда, строка sidebar — только если закреплена.
      registerPanels(ctx)

      try {
        // Подробный предпросмотр — только на странице своего плагина.
        ctx.slots.inject('plugins.detail.section', () =>
          ctx.slots.register(
            {
              name: 'plugins.detail.section',
              id: 'dsh-cards-detail',
              order: 57,
              locale: NS,
            },
            DetailSection,
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
