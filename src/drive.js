export const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL
export const UPLOAD_KEY = import.meta.env.VITE_UPLOAD_KEY
export const ITEM_CSV = import.meta.env.VITE_ITEM_CSV_URL

export const thumb = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w200`
export const thumbUrls = (id) => [
  `https://lh3.googleusercontent.com/d/${id}=w200`,
  `https://drive.google.com/thumbnail?id=${id}&sz=w200`,
]
export const fullUrls = (id) => [
  `https://lh3.googleusercontent.com/d/${id}=w1600`,
  `https://drive.google.com/thumbnail?id=${id}&sz=w1600`,
]
export const full = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w1600`
export const view = (id) => `https://drive.google.com/file/d/${id}/view`

const toBase64 = (blob) =>
  new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.readAsDataURL(blob)
  })

// Content-Type text/plain = tanpa preflight CORS (wajib untuk Apps Script)
async function callScript(payload) {
  if (!UPLOAD_URL || !UPLOAD_URL.startsWith('https://script.google.com/'))
    throw new Error('VITE_UPLOAD_URL belum diisi / salah (harus https://script.google.com/macros/s/.../exec)')
  const r = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: UPLOAD_KEY, ...payload }),
  })
  const t = await r.text()
  let j
  try { j = JSON.parse(t) } catch {
    throw new Error('Script Drive tidak mengembalikan JSON. Cek VITE_UPLOAD_URL dan akses deployment (Who has access = Anyone).')
  }
  if (j.error) throw new Error(j.error)
  return j
}

// Content-Type text/plain = tanpa preflight CORS (wajib untuk Apps Script)
export async function uploadPhoto(blob, name) {
  return (await callScript({ name, data: await toBase64(blob) })).id
}

export async function deletePhotos(ids) {
  if (!ids || !ids.length) return 0
  return (await callScript({ action: 'delete', ids })).deleted
}

export function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows
}

const cleanOpt = (x) => {
  const v = (x || '').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
  return v ? v[0].toUpperCase() + v.slice(1) : ''
}

// Satu kali fetch CSV: item master (kolom A,B) + daftar tindakan (kolom paling belakang, header "TINDAKAN")
let masterP = null
export function loadMaster() {
  if (!masterP) {
    masterP = fetch(ITEM_CSV)
      .then((r) => r.text())
      .then((t) => {
        const rows = parseCSV(t)
        const head = (rows[0] || []).map((h) => (h || '').trim())
        let ti = head.findIndex((h) => /tindak|instruksi|action/i.test(h))
        if (ti < 0 && head.length > 3) ti = head.length - 1
        const body = rows.slice(1)
        const items = body.filter((r) => r[0] && r[0].trim()).map((r) => ({ code: r[0].trim(), name: (r[1] || '').trim() }))
        const seen = new Set()
        const tindakan = []
        if (ti >= 0) body.forEach((r) => {
          ;(r[ti] || '').split(/[,\/;]/).forEach((p) => {
            const v = cleanOpt(p)
            if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); tindakan.push(v) }
          })
        })
        return { items, tindakan }
      })
      .catch((e) => { masterP = null; throw e })
  }
  return masterP
}

export const loadItems = () => loadMaster().then((m) => m.items)
