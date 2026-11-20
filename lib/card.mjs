/**
 * Разбор блока ```dsh-card.
 *
 * Формат намеренно простой: JSON внутри блока, поэтому карточку можно собрать
 * руками в сообщении или попросить ассистента её выдать. Ошибка разбора не
 * бросает исключение: интерфейс в этом случае покажет исходный текст.
 */

/**
 * Проверить и привести карточку к безопасной форме.
 * @param {string} text содержимое блока
 * @returns {{ ok: true, card: object } | { ok: false, reason: string }}
 */
export function parseCard(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, reason: 'пустой блок' }
  }
  let raw
  try {
    raw = JSON.parse(text)
  } catch (error) {
    return { ok: false, reason: `не JSON: ${error instanceof Error ? error.message : String(error)}` }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'ожидался объект' }
  }

  const card = {
    title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : '',
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.slice(0, 300) : '',
    rows: [],
    list: [],
    note: typeof raw.note === 'string' ? raw.note.slice(0, 600) : '',
    tone: ['info', 'success', 'warning', 'danger'].includes(raw.tone) ? raw.tone : 'info',
  }

  if (Array.isArray(raw.rows)) {
    for (const row of raw.rows.slice(0, 40)) {
      if (row === null || typeof row !== 'object') continue
      const label = typeof row.label === 'string' ? row.label.slice(0, 120) : ''
      const value = row.value === undefined || row.value === null ? '' : String(row.value).slice(0, 400)
      if (label === '' && value === '') continue
      card.rows.push({ label, value })
    }
  }

  if (Array.isArray(raw.list)) {
    for (const item of raw.list.slice(0, 40)) {
      const text = typeof item === 'string' ? item : typeof item?.text === 'string' ? item.text : ''
      if (text.trim() === '') continue
      card.list.push(text.slice(0, 400))
    }
  }

  if (card.title === '' && card.subtitle === '' && card.rows.length === 0 && card.list.length === 0 && card.note === '') {
    return { ok: false, reason: 'карточка пустая' }
  }
  return { ok: true, card }
}

/** Цвета по тону карточки: только акцент, фон остаётся темой. */
export const TONES = {
  info: 'rgba(84,126,214,0.85)',
  success: 'rgba(47,158,68,0.85)',
  warning: 'rgba(232,89,12,0.9)',
  danger: 'rgba(209,36,47,0.9)',
}
