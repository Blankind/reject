export const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL
export const UPLOAD_KEY = import.meta.env.VITE_UPLOAD_KEY
export const ITEM_CSV = import.meta.env.VITE_ITEM_CSV_URL

export const thumb = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w200`
export const view = (id) => `https://drive.google.com/file/d/${id}/view`

const toBase64 = (blob) =>
  new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.readAsDataURL(blob)
  })

// Content-Type text/plain = tanpa preflight CORS (wajib untuk Apps Script)
export async function uploadPhoto(blob, name) {
  const r = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: UPLOAD_KEY, name, data: await toBase64(blob) }),
  })
  const j = await r.json()
  if (j.error) throw new Error(j.error)
  return j.id
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

export async function loadItems() {
  const t = await (await fetch(ITEM_CSV)).text()
  return parseCSV(t).slice(1) // baris 1 = header
    .filter((r) => r[0] && r[0].trim())
    .map((r) => ({ code: r[0].trim(), name: (r[1] || '').trim() }))
}
