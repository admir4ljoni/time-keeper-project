// Pure helpers. Used by app.js in the browser and by test.js in Node.

const STATUS = {
  pending: 'Menunggu',
  running: 'Berjalan',
  completed: 'Selesai',
  skipped: 'Dilewati',
}

// 65 -> "01:05", 7200 -> "120:00"
function fmt(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Timestamp-based so it never drifts and survives reloads.
function elapsedMs(timer, now) {
  return timer.accumulated + (timer.startedAt ? now - timer.startedAt : 0)
}

// Every field quoted, inner quotes doubled (RFC 4180).
function toCSV(rows) {
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
}

// +5 -> "+00:05", -52 -> "−00:52"
function fmtDiff(sec) {
  return (sec > 0 ? '+' : sec < 0 ? '−' : '±') + fmt(Math.abs(sec))
}

// 5700 -> "1 jam 35 menit"
function human(sec) {
  const parts = [[Math.floor(sec / 3600), 'jam'], [Math.floor((sec % 3600) / 60), 'menit'], [sec % 60, 'detik']]
  return parts.filter(([n]) => n).map(([n, w]) => `${n} ${w}`).join(' ') || '0 detik'
}

// Timekeeper signal: 'ok', 'warn' in the last minute (or last 20% of short items), 'over' past target.
function signal(elapsed, expected) {
  const left = expected - elapsed
  if (left < 0) return 'over'
  if (left <= Math.min(60, expected / 5)) return 'warn'
  return 'ok'
}

function moveItem(arr, from, to) {
  const copy = [...arr]
  copy.splice(to, 0, copy.splice(from, 1)[0])
  return copy
}

if (typeof module !== 'undefined') module.exports = { STATUS, fmt, fmtDiff, human, signal, elapsedMs, toCSV, moveItem }
