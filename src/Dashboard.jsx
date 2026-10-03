import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { thumbUrls, fullUrls, deletePhotos } from './drive'
import { WAREHOUSES } from './config'

function Img({ urls, className, ...rest }) {
  const [k, setK] = useState(0)
  if (k >= urls.length) return <span className={'noimg ' + (className || '')} title="Foto tidak bisa dimuat">!</span>
  return <img src={urls[k]} className={className} referrerPolicy="no-referrer" loading="lazy" onError={() => setK(k + 1)} {...rest} />
}

const iso = (d) => d.toISOString().slice(0, 10)
const fmt = (s) => new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })

export default function Dashboard() {
  const now = new Date()
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(iso(now))
  const [wh, setWh] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [box, setBox] = useState(null) // { ids, i } -> popup foto
  const [del, setDel] = useState(null) // { id, label }
  const [pin, setPin] = useState('')
  const [delErr, setDelErr] = useState('')
  const [delBusy, setDelBusy] = useState(false)

  const doDelete = async () => {
    setDelBusy(true); setDelErr('')
    const { error } = await supabase.rpc('delete_reject', { p_id: del.id, p_pin: pin })
    setDelBusy(false)
    if (error) return setDelErr(error.message.includes('PIN') ? 'PIN salah' : error.message)
    let fotoGagal = false
    try { await deletePhotos(del.photos) } catch { fotoGagal = true }
    setDel(null); setPin(''); load()
    if (fotoGagal) alert('Data terhapus, tapi foto di Drive gagal dihapus. Hapus manual di folder Reject Foto.')
  }

  const load = async () => {
    setLoading(true)
    let q = supabase.from('rejects').select('*')
      .gte('created_at', new Date(from + 'T00:00:00').toISOString())
      .lte('created_at', new Date(to + 'T23:59:59').toISOString())
      .order('created_at', { ascending: false }).limit(2000)
    if (wh) q = q.eq('warehouse', wh)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [from, to, wh])

  useEffect(() => {
    if (!box) return
    const n = box.ids.length
    const onKey = (e) => {
      if (e.key === 'Escape') setBox(null)
      if (e.key === 'ArrowRight') setBox((b) => ({ ...b, i: (b.i + 1) % n }))
      if (e.key === 'ArrowLeft') setBox((b) => ({ ...b, i: (b.i - 1 + n) % n }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [box])

  const { total, items, byWh, byItem } = useMemo(() => {
    const w = {}, i = {}
    let t = 0
    rows.forEach((r) => {
      t += r.qty
      w[r.warehouse] = (w[r.warehouse] || 0) + r.qty
      i[r.item_code] = i[r.item_code] || { code: r.item_code, name: r.item_name, qty: 0 }
      i[r.item_code].qty += r.qty
    })
    const list = Object.values(i).sort((a, b) => b.qty - a.qty)
    return { total: t, items: list.length, byWh: Object.entries(w).sort((a, b) => b[1] - a[1]), byItem: list.slice(0, 10) }
  }, [rows])

  return (
    <>
      <div className="card">
        <div className="g3">
          <div><label>Dari</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label>Sampai</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div><label>Warehouse</label>
            <select value={wh} onChange={(e) => setWh(e.target.value)}>
              <option value="">Semua Warehouse</option>
              {WAREHOUSES.map((w) => <option key={w}>{w}</option>)}
            </select></div>
        </div>
        <div className="kpi" style={{ marginTop: 14 }}>
          <div><b>{total.toLocaleString('id-ID')}</b><span>Total Qty Reject</span></div>
          <div><b>{rows.length}</b><span>Jumlah Input</span></div>
          <div><b>{items}</b><span>Item Berbeda</span></div>
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <b>Per Warehouse</b>
          <table><thead><tr><th>Warehouse</th><th>Qty</th></tr></thead>
            <tbody>{byWh.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <b>Top 10 Item Reject</b>
          <table><thead><tr><th>Item</th><th>Qty</th></tr></thead>
            <tbody>{byItem.map((r) => <tr key={r.code}><td>{r.code}<br /><small>{r.name}</small></td><td>{r.qty}</td></tr>)}</tbody></table>
        </div>
      </div>

      <div className="card scroll">
        <b>Riwayat {loading && '(memuat...)'}</b>
        <table>
          <thead><tr><th>Waktu</th><th>WH</th><th>Item</th><th>Qty</th><th>Keterangan</th><th>Foto</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmt(r.created_at)}</td><td>{r.warehouse}</td>
                <td>{r.item_code}<br /><small>{r.item_name}</small></td>
                <td>{r.qty}</td><td>{r.keterangan}</td>
                <td><div className="pics">{r.photos.map((id, i) => (
                  <Img key={id} urls={thumbUrls(id)} onClick={() => setBox({ ids: r.photos, i })} />))}</div></td>
                <td><button className="del" onClick={() => { setDel({ id: r.id, photos: r.photos, label: `${r.item_code} · ${r.qty} · ${fmt(r.created_at)}` }); setPin(''); setDelErr('') }}>Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {del && (
        <div className="lb" onClick={() => setDel(null)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <b>Hapus input ini?</b>
            <small style={{ color: '#888' }}>Foto di Google Drive ikut dihapus (masuk Trash).</small>
            <p>{del.label}</p>
            <input type="password" placeholder="PIN admin" value={pin} autoFocus
              onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pin && doDelete()} />
            {delErr && <div className="msg err">{delErr}</div>}
            <div className="btns">
              <button className="btn dark" disabled={delBusy || !pin} onClick={doDelete}>Hapus</button>
              <button className="btn" onClick={() => setDel(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {box && (
        <div className="lb" onClick={() => setBox(null)}>
          <button className="lbx" onClick={() => setBox(null)}>×</button>
          {box.ids.length > 1 && (
            <button className="lbn l" onClick={(e) => { e.stopPropagation(); setBox({ ...box, i: (box.i - 1 + box.ids.length) % box.ids.length }) }}>‹</button>
          )}
          <Img key={box.ids[box.i]} urls={fullUrls(box.ids[box.i])} onClick={(e) => e.stopPropagation()} />
          {box.ids.length > 1 && (
            <button className="lbn r" onClick={(e) => { e.stopPropagation(); setBox({ ...box, i: (box.i + 1) % box.ids.length }) }}>›</button>
          )}
          <div className="lbc">{box.i + 1} / {box.ids.length}</div>
        </div>
      )}
    </>
  )
}
