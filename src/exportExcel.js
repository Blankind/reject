import { view } from './drive'

const FONT = { name: 'Arial', size: 10 }

const fmtWaktu = (s) =>
  new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })

// Export baris rejects ke .xlsx. Foto = hyperlink Drive (satu kolom per foto, tanpa batas jumlah).
export async function exportRejects(rows) {
  const mod = await import('exceljs/dist/exceljs.min.js')
  const ExcelJS = mod.default || mod

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Reject Management'
  const ws = wb.addWorksheet('Reject', { views: [{ state: 'frozen', ySplit: 1 }] })

  const nLink = rows.reduce((m, r) => Math.max(m, (r.photos || []).length), 1) // tanpa batas: kolom = jumlah foto terbanyak
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
  for (let i = 1; i <= nLink; i++) cols.push({ header: `Foto ${i}`, key: 'f' + i, width: 11 })
  ws.columns = cols

  const yn = (v) => (v ? 'Ya' : 'Tidak')
  rows.forEach((r) => {
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
    })
    row.getCell('qty').numFmt = '#,##0.###'
    photos.forEach((id, i) => {
      row.getCell('f' + (i + 1)).value = { text: `Foto ${i + 1}`, hyperlink: view(id) }
    })
  })

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
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }

  // Rekap per warehouse
  const sum = wb.addWorksheet('Rekap Warehouse')
  sum.columns = [{ header: 'Warehouse', key: 'w', width: 18 }, { header: 'Jumlah Input', key: 'n', width: 14 }, { header: 'Total Qty', key: 'q', width: 14 }]
  const m = {}
  rows.forEach((r) => { m[r.warehouse] = m[r.warehouse] || { n: 0, q: 0 }; m[r.warehouse].n++; m[r.warehouse].q += Number(r.qty) })
  Object.entries(m).sort((a, b) => b[1].q - a[1].q).forEach(([w, v]) => sum.addRow({ w, n: v.n, q: Math.round(v.q * 1000) / 1000 }))
  sum.eachRow((r, n) => r.eachCell((c) => { c.font = n === 1 ? { ...FONT, bold: true } : FONT }))
  sum.getColumn('q').numFmt = '#,##0.###'

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `reject_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}
