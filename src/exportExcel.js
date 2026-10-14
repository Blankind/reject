import { fetchImages, view } from './drive'

const MAX_FOTO = 5 // maks kolom foto per baris (mode dengan foto)
const BOX_W = 130, BOX_H = 100 // ukuran foto di sel (px)
const FONT = { name: 'Arial', size: 10 }

const fmtWaktu = (s) =>
  new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })

const imgSize = (dataUrl) =>
  new Promise((res) => {
    const im = new Image()
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight })
    im.onerror = () => res({ w: BOX_W, h: BOX_H })
    im.src = dataUrl
  })

// Ambil semua foto: batch 10 id, 3 request paralel
async function loadAllImages(ids, onProgress) {
  const out = {}
  const batches = []
  for (let i = 0; i < ids.length; i += 10) batches.push(ids.slice(i, i + 10))
  let done = 0, next = 0
  const worker = async () => {
    while (next < batches.length) {
      const b = batches[next++]
      try { Object.assign(out, await fetchImages(b)) } catch { /* foto gagal = sel kosong */ }
      done += b.length
      onProgress && onProgress(Math.min(done, ids.length), ids.length)
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return out
}

/**
 * rows       : baris rejects (sudah terfilter)
 * withPhotos : true = embed gambar, false = hanya link Drive
 * onProgress : (teks) => void
 */
export async function exportRejects(rows, { withPhotos = false, onProgress = () => {} } = {}) {
  const mod = await import('exceljs/dist/exceljs.min.js')
  const ExcelJS = mod.default || mod

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Reject Management'
  const ws = wb.addWorksheet('Reject', { views: [{ state: 'frozen', ySplit: 1 }] })

  const nFoto = withPhotos ? Math.min(MAX_FOTO, Math.max(1, ...rows.map((r) => (r.photos || []).length))) : 0

  const cols = [
    { header: 'Waktu', key: 'waktu', width: 17 },
    { header: 'Warehouse', key: 'wh', width: 12 },
    { header: 'Item Code', key: 'code', width: 16 },
    { header: 'Item Name', key: 'name', width: 34 },
    { header: 'Qty', key: 'qty', width: 10 },
    { header: 'Keterangan', key: 'ket', width: 28 },
    { header: 'Tindakan', key: 'tin', width: 26 },
    { header: 'Stock Dipindah (ERP)', key: 'sp', width: 12 },
    { header: 'Sudah Ditarik', key: 'dt', width: 12 },
    { header: 'Keluar ERP', key: 'ek', width: 12 },
    { header: 'Jml Foto', key: 'jf', width: 9 },
  ]
  if (withPhotos) for (let i = 1; i <= nFoto; i++) cols.push({ header: `Foto ${i}`, key: 'f' + i, width: Math.ceil(BOX_W / 7) + 1 })
  else cols.push({ header: 'Link Foto', key: 'link', width: 45 })
  ws.columns = cols

  // Ambil gambar dulu
  let imgs = {}
  if (withPhotos) {
    const ids = [...new Set(rows.flatMap((r) => (r.photos || []).slice(0, nFoto)))]
    onProgress(`Ambil foto 0/${ids.length}...`)
    imgs = await loadAllImages(ids, (d, t) => onProgress(`Ambil foto ${d}/${t}...`))
  }

  onProgress('Menyusun Excel...')
  const yn = (v) => (v ? 'Ya' : 'Tidak')
  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri]
    const photos = r.photos || []
    const row = ws.addRow({
      waktu: fmtWaktu(r.created_at),
      wh: r.warehouse,
      code: r.item_code,
      name: r.item_name,
      qty: Number(r.qty),
      ket: r.keterangan || '',
      tin: r.tindakan || '',
      sp: yn(r.stock_pindah),
      dt: yn(r.ditarik),
      ek: yn(r.erp_keluar),
      jf: photos.length,
      link: '',
    })
    row.getCell('qty').numFmt = '#,##0.###'

    if (withPhotos) {
      if (photos.length) row.height = BOX_H * 0.75 + 6 // poin; px*0.75
      for (let i = 0; i < Math.min(nFoto, photos.length); i++) {
        const im = imgs[photos[i]]
        if (!im) { row.getCell('f' + (i + 1)).value = { text: 'Buka foto', hyperlink: view(photos[i]) }; continue }
        const dataUrl = `data:${im.type || 'image/jpeg'};base64,${im.b64}`
        const { w, h } = await imgSize(dataUrl)
        const s = Math.min(BOX_W / w, BOX_H / h)
        const id = wb.addImage({ base64: dataUrl, extension: /png/i.test(im.type) ? 'png' : 'jpeg' })
        const c = cols.findIndex((x) => x.key === 'f' + (i + 1)) // 0-based
        ws.addImage(id, { tl: { col: c + 0.05, row: ri + 1 + 0.05 }, ext: { width: w * s - 4, height: h * s - 4 } })
      }
      if (photos.length > nFoto) {
        row.getCell('jf').value = `${photos.length} (tampil ${nFoto})`
      }
    } else {
      // link pertama jadi hyperlink, sisanya di-join teks
      if (photos.length) {
        row.getCell('link').value = { text: photos.map((_, i) => `Foto ${i + 1}`).join(' | '), hyperlink: view(photos[0]) }
        // semua link lengkap sebagai catatan di sel
        row.getCell('link').note = photos.map((id, i) => `Foto ${i + 1}: ${view(id)}`).join('\n')
      }
    }
  }

  // Style
  const head = ws.getRow(1)
  head.height = 30
  head.eachCell((c) => {
    c.font = { ...FONT, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  ws.eachRow((row, n) => {
    if (n === 1) return
    row.eachCell({ includeEmpty: true }, (c) => {
      c.font = c.value && c.value.hyperlink ? { ...FONT, color: { argb: 'FF0563C1' }, underline: true } : FONT
      c.alignment = { vertical: 'middle', wrapText: true }
      c.border = { bottom: { style: 'hair', color: { argb: 'FFBBBBBB' } } }
    })
  })
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } }

  // Sheet ringkas per warehouse
  const sum = wb.addWorksheet('Rekap Warehouse')
  sum.columns = [{ header: 'Warehouse', key: 'w', width: 18 }, { header: 'Jumlah Input', key: 'n', width: 14 }, { header: 'Total Qty', key: 'q', width: 14 }]
  const m = {}
  rows.forEach((r) => { m[r.warehouse] = m[r.warehouse] || { n: 0, q: 0 }; m[r.warehouse].n++; m[r.warehouse].q += Number(r.qty) })
  Object.entries(m).sort((a, b) => b[1].q - a[1].q).forEach(([w, v]) => sum.addRow({ w, n: v.n, q: Math.round(v.q * 1000) / 1000 }))
  sum.getRow(1).eachCell((c) => { c.font = { ...FONT, bold: true } })
  sum.eachRow((r, n) => { if (n > 1) r.eachCell((c) => { c.font = FONT }); })
  sum.getColumn('q').numFmt = '#,##0.###'

  onProgress('Menyimpan file...')
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = URL.createObjectURL(blob)
  a.download = `reject_${stamp}${withPhotos ? '_foto' : ''}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}
