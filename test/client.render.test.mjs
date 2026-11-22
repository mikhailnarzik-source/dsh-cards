/**
 * Проверки рендера страницы плагина (слот `plugins.detail.section`) в едином
 * стиле DSH: контент по центру (maxWidth 960), шапка с иконкой и статус-чипом,
 * карточки-секции, единая система кнопок (спека `.tools/plugin-design-spec-v2.md`),
 * адаптив и только токены темы в цветах.
 *
 * `client.js` исполняется в vm с поддельным `window.__ModuleLoader__` и
 * минимальным React: настоящий браузер для проверки разметки не нужен.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const SOURCE = await readFile(new URL('../client.js', import.meta.url), 'utf8')
const PLUGIN = 'dsh-cards'

/** Поддельный React: хуки отдают начальные значения или заданные тестом. */
function makeReact(states = []) {
  let index = 0
  return {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children: children.flat(Infinity) }
    },
    useState(initial) {
      const value = index < states.length
        ? states[index]
        : (typeof initial === 'function' ? initial() : initial)
      index += 1
      return [value, () => {}]
    },
    useEffect() {},
    useCallback(fn) { return fn },
    useMemo(fn) { return fn() },
    useRef(value) { return { current: value } },
  }
}

function loadClient() {
  let registration
  const sandbox = {
    window: { __ModuleLoader__: { load(options) { registration = options } } },
    console,
  }
  vm.runInNewContext(SOURCE, sandbox, { filename: 'client.js' })
  assert.ok(registration !== undefined, 'client.js не вызвал window.__ModuleLoader__.load')
  return registration
}

function makeContext() {
  const locales = []
  const slots = []
  const ctx = {
    locale: {
      register(namespace, dictionaries) { locales.push({ namespace, dictionaries }) },
      bind() { return (key) => `t:${key}` },
    },
    slots: {
      inject(name, callback) { callback() },
      register(options, component) { slots.push({ options, component }); return () => {} },
    },
  }
  return { ctx, locales, slots }
}

/** Отрисовать секцию страницы плагина и развернуть все функциональные компоненты. */
function renderDetail(states = []) {
  const registration = loadClient()
  const module = registration.factory((name) => {
    if (name === 'react') return makeReact(states)
    throw new Error(`неожиданный require: ${name}`)
  })
  const { ctx, locales, slots } = makeContext()
  module.apply(ctx)
  const section = slots.find((item) => item.options.name === 'plugins.detail.section')
  assert.ok(section, 'секция plugins.detail.section не зарегистрирована')
  const tree = section.component({ subject: { kind: 'bundle', pkg: { name: PLUGIN } } })
  return { ...survey(tree), locales }
}

/** Обойти дерево: вернуть элементы и тексты, попутно раскрывая компоненты. */
function survey(node, acc = { nodes: [], texts: [] }) {
  if (node === null || node === undefined || node === false || node === true) return acc
  if (typeof node === 'string' || typeof node === 'number') {
    acc.texts.push(String(node))
    return acc
  }
  if (Array.isArray(node)) {
    for (const item of node) survey(item, acc)
    return acc
  }
  if (typeof node !== 'object') return acc
  if (typeof node.type === 'function') {
    survey(node.type({ ...(node.props ?? {}), children: node.children }), acc)
    return acc
  }
  acc.nodes.push(node)
  for (const child of node.children ?? []) survey(child, acc)
  return acc
}

/** Текст внутри одного элемента (без подъёма к родителям). */
function textsOf(node, out = []) {
  for (const child of node.children ?? []) {
    if (typeof child === 'string' || typeof child === 'number') out.push(String(child))
    else if (child !== null && typeof child === 'object') textsOf(child, out)
  }
  return out
}

/** CSS страницы: все <style> в дереве. */
function pageCss(nodes) {
  return nodes
    .filter((node) => node.type === 'style')
    .flatMap((node) => node.children)
    .join('\n')
}

test('страница: центрированный контейнер maxWidth 960 и адаптив', () => {
  const { nodes } = renderDetail()
  const page = nodes.find((node) => node.props?.style?.maxWidth === 960)
  assert.ok(page, 'нет контейнера maxWidth 960')
  const style = page.props.style
  assert.equal(style.width, '100%')
  assert.equal(style.margin, '0 auto')
  assert.equal(style.padding, '24px 28px 40px')
  assert.equal(style.boxSizing, 'border-box')
  assert.equal(style.display, 'flex')
  assert.equal(style.flexDirection, 'column')
  assert.equal(style.gap, 16)

  const css = pageCss(nodes)
  assert.match(css, /@media \(max-width: 900px\)/, 'на 900 px — одна колонка')
  assert.match(css, /@media \(max-width: 640px\)/, 'на 640 px — компактные поля')
  assert.match(css, /grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,280px\),1fr\)\)/)
})

test('шапка: иконка 52, заголовок 20/600, статус-чип и «Обновить»', () => {
  const { nodes } = renderDetail()
  const icon = nodes.find((node) => node.props?.style?.width === 52 && node.props?.style?.height === 52)
  assert.ok(icon, 'нет квадрата-иконки 52×52')
  assert.equal(icon.props.style.borderRadius, 14)
  assert.ok(nodes.some((node) => node.props?.style?.display === 'inline-flex'), 'шапка собрана на flex')
  assert.ok(nodes.some((node) => node.props?.className === 'dshc-page'), 'страница есть')

  const title = nodes.find((node) => node.type === 'h1')
  assert.ok(title, 'нет заголовка h1')
  assert.equal(title.props.style.fontSize, 20)
  assert.equal(title.props.style.fontWeight, 600)
  assert.ok(nodes.some((node) => (node.children ?? []).includes('🧩')), 'в иконке есть эмодзи')

  const chip = nodes.find((node) => node.props?.style?.borderRadius === 999)
  assert.ok(chip, 'нет статус-чипа')
  assert.equal(chip.props.style.display, 'inline-flex')
  assert.equal(chip.props.style.padding, '3px 9px')

  const refresh = nodes.find(
    (node) => node.type === 'button' && textsOf(node).includes('t:refresh'),
  )
  assert.ok(refresh, 'нет кнопки «Обновить» в шапке')
  assert.equal(refresh.props.style.height, 32)
  assert.equal(refresh.props.style.borderRadius, 10)
  assert.equal(refresh.props.style.padding, '0 14px')
  assert.equal(refresh.props.style.background, 'transparent')
  assert.equal(typeof refresh.props.onClick, 'function')
})

test('контент: карточки-секции с акцентной полоской и полями', () => {
  const { nodes } = renderDetail()
  const cards = nodes.filter(
    (node) => node.type === 'section' && node.props?.style?.borderRadius === 14,
  )
  assert.ok(cards.length >= 2, `ожидались две карточки-секции, найдено ${cards.length}`)
  for (const card of cards) {
    assert.equal(card.props.style.background, 'var(--dsw-alias-bg-layer-1)')
    assert.equal(card.props.style.border, '1px solid var(--dsw-alias-border-l2)')
    assert.equal(card.props.style.padding, 16)
    assert.equal(card.props.style.display, 'flex')
    assert.equal(card.props.style.flexDirection, 'column')
    assert.equal(card.props.style.gap, 12)
    assert.equal(card.props.style.minWidth, 0)
  }

  const bars = nodes.filter(
    (node) => node.props?.style?.width === 3 && node.props?.style?.height === 14,
  )
  assert.ok(bars.length >= 2, 'нет акцентных полосок у заголовков секций')
  for (const bar of bars) {
    assert.equal(bar.props.style.borderRadius, 2)
    assert.match(bar.props.style.background, /--dsw-alias-brand-primary/)
  }

  const sectionTitles = nodes.filter(
    (node) => node.type === 'h2' && node.props?.style?.fontSize === 14,
  )
  assert.ok(sectionTitles.length >= 2, 'нет заголовков секций 14/600')
  assert.equal(sectionTitles[0].props.style.fontWeight, 600)

  const area = nodes.find((node) => node.type === 'textarea')
  assert.ok(area, 'нет поля «Пример»')
  assert.equal(area.props.style.borderRadius, 9)
  assert.equal(area.props.style.border, '1px solid var(--dsw-alias-border-l2)')
  assert.equal(area.props.style.background, 'var(--dsw-alias-bg-layer-2)')
})

test('единая система кнопок: 36/32, радиус 10, мягкая заливка brand', () => {
  const { nodes } = renderDetail()
  const buttons = nodes.filter((node) => node.type === 'button')
  assert.ok(buttons.length >= 2, 'на странице есть кнопки')

  for (const button of buttons) {
    const style = button.props.style ?? {}
    assert.ok([32, 36].includes(style.height), `высота кнопки 32 или 36, а не ${style.height}`)
    assert.equal(style.borderRadius, 10, 'радиус кнопки 10')
    assert.equal(style.display, 'inline-flex', 'кнопка — inline-flex')
    assert.equal(style.fontWeight, 600, 'кнопка — 600')
    assert.equal(style.fontSize, 12.5, 'кнопка — 12.5')
    assert.equal(style.whiteSpace, 'nowrap', 'подпись кнопки не переносится')
    if (textsOf(button).join('').trim() !== '') {
      assert.equal(style.width, undefined, 'у текстовой кнопки нет фиксированной ширины')
      assert.equal(style.minWidth, undefined, 'у кнопки нет фиксированной min-width')
    }
    const color = String(style.color ?? '')
    assert.doesNotMatch(color, /#fff|#ffffff|label-primary-inverted/i, 'нет белого текста на кнопке')
  }

  const primary = nodes.find(
    (node) => node.type === 'button' && textsOf(node).includes('t:copy'),
  )
  assert.ok(primary, 'нет кнопки «Скопировать пример»')
  const style = primary.props.style
  assert.match(String(style.background), /color-mix\(in srgb, var\(--dsw-alias-brand-primary\) 18%, transparent\)/)
  assert.match(String(style.border), /color-mix\(in srgb, var\(--dsw-alias-brand-primary\) 55%, transparent\)/)
  assert.equal(style.color, 'var(--dsw-alias-brand-primary)')
  assert.equal(style.height, 36)

  const css = pageCss(nodes)
  assert.match(css, /\.dshc-page-primary:hover:not\(:disabled\)/, 'есть hover у primary')
  assert.match(css, /\.dshc-page-primary:disabled/, 'есть disabled у primary')
  assert.match(css, /:focus-visible/, 'есть фокус-рамка у кнопок')
  assert.doesNotMatch(css, /#fff|#ffffff/i, 'в CSS нет белого текста')
})

test('адаптив: сетка auto-fit, перенос кнопок и длинных строк', () => {
  const { nodes } = renderDetail()
  const grid = nodes.find((node) => node.props?.style?.display === 'grid')
  assert.ok(grid, 'нет сетки карточек')
  assert.equal(grid.props.style.gridTemplateColumns, 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))')
  assert.equal(grid.props.style.alignItems, 'stretch', 'карточки в ряду одной высоты')
  assert.equal(grid.props.style.minWidth, 0)

  const headRight = nodes.find((node) => node.props?.className === 'dshc-page-head-right')
  assert.ok(headRight, 'правая часть шапки переносится')
  assert.equal(headRight.props.style.flexWrap, 'wrap')

  const hint = nodes.find((node) => typeof node.props?.style?.overflowWrap === 'string')
  assert.ok(
    hint !== undefined || /overflowWrap: 'anywhere'/.test(SOURCE),
    'длинные строки переносятся',
  )
  assert.match(SOURCE, /overflowWrap: 'anywhere'/, 'у подсказок есть overflow-wrap:anywhere')

  const css = pageCss(nodes)
  assert.match(css, /\.dshc-page\{overflow-wrap:anywhere;\}/)
  assert.match(css, /\.dshc-page-actions\{[^}]*flex-wrap:wrap/)
  assert.match(css, /\.dshc-page-actions\{[^}]*margin-top:auto/, 'футер карточки прижат к низу')
})

test('кнопки карточек в ответе: та же единая система', () => {
  assert.match(SOURCE, /\.dshc-action \{/, 'стили кнопок карточки на месте')
  assert.match(SOURCE, /\.dshc-action \{[^}]*height: 36px/, 'кнопка карточки — 36 px')
  assert.match(SOURCE, /\.dshc-action \{[^}]*border-radius: 10px/, 'кнопка карточки — радиус 10')
  assert.match(SOURCE, /\.dshc-action \{[^}]*color-mix\(in srgb, var\(--dsw-alias-brand-primary\) 55%/, 'мягкая рамка brand')
  assert.match(SOURCE, /\.dshc-action:hover:not\(:disabled\)/, 'есть hover у кнопки карточки')
  assert.doesNotMatch(SOURCE, /rgba\(106,139,208/, 'нет старых синих rgba-кнопок')
  assert.match(SOURCE, /\.dshc-actions \{[^}]*flex-wrap: wrap/, 'кнопки карточки переносятся')
})

test('цвета: только токены темы, жёстких hex и белого текста нет', () => {
  const { nodes } = renderDetail()
  const styles = nodes
    .map((node) => node.props?.style)
    .filter((style) => style !== undefined && style !== null)
  const dump = JSON.stringify(styles)
  assert.doesNotMatch(dump, /#[0-9a-fA-F]{3,8}\b/, 'в стилях есть жёсткий hex-цвет')
  assert.doesNotMatch(dump, /label-primary-inverted/, 'нет белого текста через label-primary-inverted')
  assert.match(dump, /var\(--dsw-alias-/, 'в стилях нет токенов темы')
})

test('свёрнутое состояние: только шапка, без карточек', () => {
  const { nodes } = renderDetail([false])
  assert.ok(nodes.some((node) => node.props?.style?.maxWidth === 960), 'страница осталась')
  assert.equal(
    nodes.filter((node) => node.type === 'section' && node.props?.style?.borderRadius === 14).length,
    0,
    'в свёрнутом виде карточки не показываются',
  )
  assert.ok(
    nodes.some((node) => node.type === 'button' && textsOf(node).includes('t:refresh')),
    'кнопка «Обновить» остаётся доступной',
  )
})

test('словари en и ru содержат одинаковые ключи', () => {
  const { locales } = renderDetail()
  const dictionaries = locales[0].dictionaries
  assert.deepEqual(Object.keys(dictionaries).sort(), ['en', 'ru'])
  assert.deepEqual(
    Object.keys(dictionaries.en).sort(),
    Object.keys(dictionaries.ru).sort(),
    'словари en и ru должны содержать одинаковые ключи',
  )
  for (const key of ['statusReady', 'statusBroken', 'brokenHint', 'refresh']) {
    assert.ok(key in dictionaries.en, `en: нет ключа ${key}`)
    assert.ok(key in dictionaries.ru, `ru: нет ключа ${key}`)
  }
})
