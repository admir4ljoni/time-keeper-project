// Run: node test.js
const assert = require('node:assert')
const { fmt, fmtDiff, human, signal, elapsedMs, toCSV, moveItem } = require('./lib.js')

assert.equal(fmt(0), '00:00')
assert.equal(fmt(65), '01:05')
assert.equal(fmt(7200), '120:00')
assert.equal(fmt(-3), '00:00')

assert.equal(elapsedMs({ startedAt: null, accumulated: 5000 }, 99999), 5000)
assert.equal(elapsedMs({ startedAt: 1000, accumulated: 5000 }, 4000), 8000)

assert.equal(toCSV([['a', 'b"c'], [1, 'x,y']]), '"a","b""c"\r\n"1","x,y"')

const arr = [1, 2, 3]
assert.deepEqual(moveItem(arr, 0, 2), [2, 3, 1])
assert.deepEqual(moveItem(arr, 2, 0), [3, 1, 2])
assert.deepEqual(arr, [1, 2, 3])

assert.equal(fmtDiff(5), '+00:05')
assert.equal(fmtDiff(-52), '−00:52')
assert.equal(fmtDiff(0), '±00:00')

assert.equal(human(5700), '1 jam 35 menit')
assert.equal(human(65), '1 menit 5 detik')
assert.equal(human(0), '0 detik')

assert.equal(signal(0, 300), 'ok')
assert.equal(signal(240, 300), 'warn')
assert.equal(signal(300, 300), 'warn')
assert.equal(signal(301, 300), 'over')
assert.equal(signal(0, 30), 'ok')
assert.equal(signal(24, 30), 'warn')

console.log('ok')
