import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCard } from '../lib/card.mjs'

test('полная карточка разбирается', () => {
  const result = parseCard(JSON.stringify({
    title: 'Релиз',
    subtitle: 'плагин',
    rows: [{ label: 'Версия', value: '1.0.0' }],
    list: ['шаг один'],
    note: 'примечание',
    tone: 'success',
  }))
  assert.equal(result.ok, true)
  assert.equal(result.card.title, 'Релиз')
  assert.equal(result.card.rows.length, 1)
  assert.equal(result.card.list.length, 1)
  assert.equal(result.card.tone, 'success')
})

test('неизвестный тон заменяется на info', () => {
  const result = parseCard(JSON.stringify({ title: 'X', tone: 'радуга' }))
  assert.equal(result.card.tone, 'info')
})

test('битый JSON не бросает исключение', () => {
  const result = parseCard('{ это не json')
  assert.equal(result.ok, false)
  assert.match(result.reason, /JSON/i)
})

test('пустая карточка отклоняется', () => {
  const result = parseCard(JSON.stringify({ rows: [], list: [] }))
  assert.equal(result.ok, false)
})

test('строки приводятся к строкам, мусор отбрасывается', () => {
  const result = parseCard(JSON.stringify({ title: 'T', rows: [{ label: 'a', value: 5 }, null, 'x'], list: [1, 'ok'] }))
  assert.equal(result.ok, true)
  assert.deepEqual(result.card.rows, [{ label: 'a', value: '5' }])
  assert.deepEqual(result.card.list, ['ok'])
})

test('огромные списки обрезаются', () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ label: `k${index}`, value: index }))
  const result = parseCard(JSON.stringify({ title: 'T', rows }))
  assert.equal(result.card.rows.length, 40)
})
