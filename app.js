// State + DOM. Pure helpers (fmt, fmtDiff, human, signal, elapsedMs, toCSV, moveItem, STATUS) live in lib.js.

const KEY = 'event-tracker-agendas' // same key as the old Vue app, so saved data still loads
const $ = (id) => document.getElementById(id)
const idleTimer = () => ({ state: 'idle', startedAt: null, accumulated: 0 })
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

let state = load()
let editingId = null
let justFinished = null // id of the row to animate after the next render
let undoSnapshot = null

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || {}
    const agendas = Array.isArray(d.agendas) ? d.agendas : []
    const i = d.currentAgendaIndex ?? null
    const valid = i !== null && !!agendas[i]
    return {
      agendas,
      currentAgendaIndex: valid ? i : null,
      timer: valid && d.timer ? d.timer : idleTimer(),
    }
  } catch (err) {
    console.error('Gagal memuat data:', err)
    return { agendas: [], currentAgendaIndex: null, timer: idleTimer() }
  }
}

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    console.error('Gagal menyimpan data:', err)
  }
  render()
}

const current = () => state.agendas[state.currentAgendaIndex] ?? null
const elapsed = () => Math.floor(elapsedMs(state.timer, Date.now()) / 1000)

// ---------- timer ----------

function start() {
  const a = current()
  if (!a || state.timer.state === 'running') return
  state.timer.state = 'running'
  state.timer.startedAt = Date.now()
  a.status = 'running'
  commit()
}

function pause() {
  const t = state.timer
  if (t.state !== 'running') return
  state.timer = { state: 'paused', startedAt: null, accumulated: elapsedMs(t, Date.now()) }
  commit()
}

function finish(status) {
  const a = current()
  if (!a || state.timer.state === 'idle') return
  a.actualTime = elapsed()
  a.status = status
  if (status === 'completed') justFinished = a.id
  state.timer = idleTimer()
  const next = state.currentAgendaIndex + 1
  state.currentAgendaIndex = next < state.agendas.length ? next : null
  commit()
}

// ---------- agendas ----------

function select(i) {
  if (i === state.currentAgendaIndex) return
  const prev = current()
  if (state.timer.state === 'idle') {
    state.currentAgendaIndex = i
    return commit()
  }
  withUndo(`Timer "${prev.name}" dihentikan.`, () => {
    prev.status = 'pending'
    state.timer = idleTimer()
    state.currentAgendaIndex = i
  })
}

function remove(i) {
  if (state.agendas[i].id === editingId) resetForm()
  withUndo(`"${state.agendas[i].name}" dihapus.`, () => {
    state.agendas.splice(i, 1)
    const cur = state.currentAgendaIndex
    if (cur === i) {
      state.timer = idleTimer()
      state.currentAgendaIndex = state.agendas.length ? Math.min(i, state.agendas.length - 1) : null
    } else if (cur > i) {
      state.currentAgendaIndex--
    }
  })
}

// Keeps the agendas, wipes the times. For running the real event after a rehearsal.
function resetTimes() {
  withUndo('Waktu semua agenda diatur ulang.', () => {
    for (const a of state.agendas) Object.assign(a, { actualTime: 0, status: 'pending' })
    state.timer = idleTimer()
    state.currentAgendaIndex = state.agendas.length ? 0 : null
  })
}

function clearAll() {
  resetForm()
  withUndo('Rundown dikosongkan.', () => {
    state = { agendas: [], currentAgendaIndex: null, timer: idleTimer() }
  })
}

// ---------- undo toast ----------
// Destructive actions run immediately and offer undo instead of asking first.
// The timer is timestamp-based, so a restored running timer is still correct.

let toastTimer
function withUndo(message, mutate) {
  undoSnapshot = JSON.stringify(state)
  mutate()
  commit()
  $('toast-text').textContent = message
  $('toast').hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(hideToast, 7000)
}

function hideToast() {
  $('toast').hidden = true
  undoSnapshot = null
}

function undo() {
  if (!undoSnapshot) return
  state = JSON.parse(undoSnapshot)
  hideToast()
  commit()
}

function reorder(from, to) {
  const a = current()
  state.agendas = moveItem(state.agendas, from, to)
  state.currentAgendaIndex = a ? state.agendas.indexOf(a) : null
  commit()
}

// ---------- form ----------

const form = $('form')

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const name = $('f-name').value.trim()
  const secs = (parseInt($('f-min').value) || 0) * 60 + (parseInt($('f-sec').value) || 0)
  if (!name) return alert('Isi nama agenda terlebih dahulu.')
  if (secs <= 0) return alert('Durasi harus lebih dari 0 detik.')

  const editing = state.agendas.find((a) => a.id === editingId)
  if (editing) {
    Object.assign(editing, { name, expectedTime: secs })
  } else {
    state.agendas.push({ id: Date.now().toString(), name, expectedTime: secs, actualTime: 0, status: 'pending' })
    if (state.currentAgendaIndex === null && state.timer.state === 'idle') {
      state.currentAgendaIndex = state.agendas.length - 1
    }
  }
  resetForm()
  commit()
  if (!editing && !reducedMotion.matches) {
    $('list').lastElementChild.animate(
      [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
      { duration: 280, easing: 'ease-out' }
    )
  }
})

function setFormMode(editing) {
  $('form-title').textContent = editing ? 'Ubah agenda' : 'Tambah agenda'
  $('f-submit').textContent = editing ? 'Simpan perubahan' : 'Tambah ke rundown'
  $('f-cancel').hidden = !editing
}

function resetForm() {
  editingId = null
  form.reset()
  setFormMode(false)
}

function startEdit(a) {
  editingId = a.id
  $('f-name').value = a.name
  $('f-min').value = Math.floor(a.expectedTime / 60)
  $('f-sec').value = a.expectedTime % 60
  setFormMode(true)
  $('f-name').focus()
}

// ---------- render ----------

const panel = $('panel')
const LABEL = { idle: 'Siap dimulai', ok: 'Berjalan', warn: 'Waktu hampir habis', over: 'Lewat waktu' }

function render() {
  renderList()
  renderPanel()
  renderReport()
}

function noteFor(a, isCurrent) {
  if (isCurrent && state.timer.state === 'running') return ['Sedang berjalan', '']
  if (isCurrent && state.timer.state === 'paused') return ['Dijeda', '']
  if (a.status === 'completed') {
    const d = a.actualTime - a.expectedTime
    if (d > 0) return [`Selesai, ${fmt(d)} lebih lama`, 'late']
    if (d < 0) return [`Selesai, ${fmt(-d)} lebih cepat`, '']
    return ['Selesai tepat waktu', '']
  }
  if (a.status === 'skipped') return [a.actualTime ? `Dilewati setelah ${fmt(a.actualTime)}` : 'Dilewati', '']
  return [isCurrent ? 'Siap dimulai' : '', '']
}

function renderList() {
  const tpl = $('item-tpl').content.firstElementChild
  $('list').replaceChildren(
    ...state.agendas.map((a, i) => {
      const li = tpl.cloneNode(true)
      const isCurrent = i === state.currentAgendaIndex
      const [note, cls] = noteFor(a, isCurrent)
      li.classList.toggle('current', isCurrent)
      li.dataset.status = a.status
      li.querySelector('.num').textContent = i + 1
      li.querySelector('.name').textContent = a.name
      li.querySelector('.note').textContent = note
      li.querySelector('.note').classList.toggle('late', cls === 'late')
      li.dataset.id = a.id
      li.querySelector('.plan-t').textContent = fmt(a.expectedTime)
      const act = li.querySelector('.act')
      if (a.status === 'completed') {
        act.textContent = fmt(a.actualTime)
        act.classList.add(a.actualTime > a.expectedTime ? 'late' : 'early')
      }
      if (isCurrent) li.querySelector('.pick').setAttribute('aria-current', 'true')
      li.querySelector('[data-act=edit]').setAttribute('aria-label', `Ubah ${a.name}`)
      li.querySelector('[data-act=remove]').setAttribute('aria-label', `Hapus ${a.name}`)
      return li
    })
  )
  const total = state.agendas.reduce((sum, a) => sum + a.expectedTime, 0)
  $('rd-total').textContent = state.agendas.length ? `${state.agendas.length} agenda, ${human(total)}` : ''
  $('list-empty').hidden = state.agendas.length > 0
  $('list-tools').hidden = state.agendas.length === 0
  $('b-reset').disabled = state.timer.state === 'idle' && state.agendas.every((a) => a.status === 'pending')

  const done = justFinished && $('list').querySelector(`[data-id="${justFinished}"]`)
  justFinished = null
  if (done && !reducedMotion.matches) celebrate(done)
}

// Completed row: tint fades in, target time gets struck through and slides left,
// actual time slides in on its right.
function celebrate(li) {
  const plan = li.querySelector('.plan')
  const act = li.querySelector('.act')
  const ease = 'cubic-bezier(.2, .7, .2, 1)'
  const dx = act.getBoundingClientRect().right - plan.getBoundingClientRect().right
  li.animate([{ backgroundColor: 'transparent' }, { backgroundColor: getComputedStyle(li).backgroundColor }], { duration: 500, easing: 'ease-out' })
  li.querySelector('.strike').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 280, delay: 150, easing: ease, fill: 'backwards' })
  plan.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 420, delay: 480, easing: ease, fill: 'backwards' })
  act.animate([{ opacity: 0, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 760, easing: ease, fill: 'backwards' })
  li.querySelector('.note').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 760, fill: 'backwards' })
}

function renderPanel() {
  const a = current()
  const t = state.timer.state
  $('p-live').hidden = !a
  $('p-empty').hidden = !!a
  if (!a) {
    const any = state.agendas.length > 0
    const waiting = state.agendas.some((x) => x.status === 'pending' || x.status === 'running')
    panel.dataset.signal = 'idle'
    panel.removeAttribute('data-paused')
    document.title = 'AKeeper'
    $('pe-title').textContent = !any ? 'Belum ada agenda' : waiting ? 'Pilih agenda' : 'Rundown selesai'
    $('pe-text').textContent = !any
      ? 'Tambahkan agenda ke rundown untuk mulai menghitung waktu.'
      : waiting
        ? 'Pilih agenda di rundown untuk mulai.'
        : 'Semua agenda sudah dijalankan. Waktu tiap agenda ada di laporan.'
    $('pe-report').hidden = !any || waiting
    return
  }
  const next = state.agendas[state.currentAgendaIndex + 1]
  $('p-name').textContent = a.name
  $('p-next').textContent = next ? `Berikutnya: ${next.name}` : 'Agenda terakhir'
  $('b-toggle').textContent = { idle: 'Mulai', running: 'Jeda', paused: 'Lanjutkan' }[t]
  $('b-skip').disabled = $('b-done').disabled = t === 'idle'
  renderClock()
}

// Called every 250ms. Big number = time remaining, then "+mm:ss" once over.
function renderClock() {
  const a = current()
  if (!a) return
  const t = state.timer.state
  const s = elapsed()
  const left = a.expectedTime - s
  const sig = t === 'idle' ? 'idle' : signal(s, a.expectedTime)
  const clock = left >= 0 ? fmt(left) : `+${fmt(-left)}`
  panel.dataset.signal = sig
  panel.toggleAttribute('data-paused', t === 'paused')
  $('p-label').textContent = t === 'paused' ? 'Dijeda' : LABEL[sig]
  $('p-clock').textContent = clock
  $('p-bar').style.width = `${Math.min(100, (s / a.expectedTime) * 100)}%`
  $('p-used').textContent = `Terpakai ${fmt(s)} dari ${fmt(a.expectedTime)}`
  document.title = t === 'idle' ? 'AKeeper' : `${clock} ${a.name}`
}

const ran = (a) => a.status === 'completed' || a.status === 'skipped'
const diff = (a) => (a.status === 'completed' ? a.actualTime - a.expectedTime : null)

function summary(list) {
  const count = (fn) => list.filter(fn).length
  const parts = [
    [count((a) => a.status === 'completed'), 'selesai'],
    [count((a) => a.status === 'skipped'), 'dilewati'],
    [count((a) => !ran(a)), 'belum dijalankan'],
  ].filter(([n]) => n).map(([n, w]) => `${n} ${w}`)
  const used = list.filter(ran).reduce((sum, a) => sum + a.actualTime, 0)
  const target = list.reduce((sum, a) => sum + a.expectedTime, 0)
  const late = count((a) => diff(a) > 0)
  let text = `${list.length} agenda: ${parts.join(', ')}. Terpakai ${human(used)} dari rencana ${human(target)}.`
  if (late) text += ` ${late} agenda melewati waktu.`
  return text
}

function renderReport() {
  const list = state.agendas
  const has = list.length > 0
  $('b-csv').disabled = !has
  $('report-empty').hidden = has
  $('report-wrap').hidden = !has
  $('rp-summary').hidden = !has
  if (has) $('rp-summary').textContent = summary(list)
  $('report-body').replaceChildren(
    ...list.map((a, i) => {
      const d = diff(a)
      const tr = document.createElement('tr')
      const cells = [
        [i + 1, 'n'],
        [a.name, 'name'],
        [fmt(a.expectedTime), 't'],
        [ran(a) ? fmt(a.actualTime) : '—', 't'],
        [d === null ? '—' : fmtDiff(d), d > 0 ? 't late' : d < 0 ? 't early' : 't'],
        [STATUS[a.status] ?? STATUS.pending, 'st'],
      ]
      for (const [text, cls] of cells) Object.assign(tr.insertCell(), { textContent: text, className: cls })
      return tr
    })
  )
}

function exportCSV() {
  const rows = [
    ['No', 'Nama Agenda', 'Waktu Di-set', 'Waktu Aktual', 'Selisih', 'Status'],
    ...state.agendas.map((a, i) => {
      const d = diff(a)
      return [i + 1, a.name, fmt(a.expectedTime), fmt(a.actualTime), d === null ? '' : fmtDiff(d), STATUS[a.status]]
    }),
  ]
  // BOM so Excel reads UTF-8
  const url = URL.createObjectURL(new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8' }))
  const date = new Date().toLocaleDateString('sv') // local YYYY-MM-DD
  Object.assign(document.createElement('a'), { href: url, download: `laporan-agenda-${date}.csv` }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- wiring ----------

function showTab(tab) {
  for (const b of document.querySelectorAll('nav button')) {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page')
    else b.removeAttribute('aria-current')
  }
  $('tab-timer').hidden = tab !== 'timer'
  $('tab-report').hidden = tab !== 'report'
}

$('b-toggle').onclick = () => (state.timer.state === 'running' ? pause() : start())
$('b-skip').onclick = () => finish('skipped')
$('b-done').onclick = () => finish('completed')
$('b-csv').onclick = exportCSV
$('pe-report').onclick = () => showTab('report')
$('f-cancel').onclick = resetForm
$('b-reset').onclick = resetTimes
$('b-clear').onclick = clearAll
$('toast-undo').onclick = undo

// Space: start/pause. F: fullscreen. Ignored while typing or on a focused button.
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || $('tab-timer').hidden) return
  if (e.target.closest('input, button, a')) return
  if (e.code === 'Space') {
    e.preventDefault()
    $('b-toggle').click()
  } else if (e.key === 'f' || e.key === 'F') {
    if (!fullBtn.hidden && current()) fullBtn.click()
  }
})
document.querySelector('nav').onclick = (e) => e.target.dataset.tab && showTab(e.target.dataset.tab)

document.querySelector('.presets').onclick = (e) => {
  const m = e.target.dataset.min
  if (!m) return
  $('f-min').value = m
  $('f-sec').value = 0
}

$('list').onclick = (e) => {
  const btn = e.target.closest('button[data-act]')
  if (!btn) return
  const i = [...$('list').children].indexOf(btn.closest('li'))
  if (btn.dataset.act === 'select') select(i)
  if (btn.dataset.act === 'edit') startEdit(state.agendas[i])
  if (btn.dataset.act === 'remove') remove(i)
}

const fullBtn = $('b-full')
fullBtn.hidden = !document.fullscreenEnabled
fullBtn.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : panel.requestFullscreen())
document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement ? 'Keluar dari layar penuh' : 'Layar penuh'
  fullBtn.setAttribute('aria-label', label)
  fullBtn.title = label
})

new Sortable($('list'), {
  handle: '.grip',
  animation: 150,
  onEnd: (e) => e.oldIndex !== e.newIndex && reorder(e.oldIndex, e.newIndex),
})

render()
setInterval(renderClock, 250)
