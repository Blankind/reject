import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { thumb, view } from './drive'

const iso = (d) => d.toISOString().slice(0, 10)
const fmt = (s) => new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })

export default function Dashboard() {
  const now = new Date()
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(iso(now))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('rejects').select('*')
      .gte('created_at', new Date(from + 'T00:00:00').toISOString())
      .lte('created_at', new Date(to + 'T23:59:59').toISOString())
      .order('created_at', { ascending: false }).limit(2000)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [from, to])

  const { total, byWh, byItem } = useMemo(() => {
    const w = {}, i = {}
    let t = 0
    rows.forEach((r) => {
      t += r.qty
      w[r.warehouse] = (w[r.warehouse] || 0) + r.qty
      const k = r.item_code
      i[k] = i[k] || { code: k, name: r.item_name, qty: 0 }
      i[k].qty += r.qty
    })
    return {
      total: t,
      byWh: Object.entries(w).sort((a, b) => b[1] - a[1]),
      byItem: Object.values(i).sort((a, b) => b.qty - a.qty).slice(0, 10),
    }
  }, [rows])

  return (
    <>
      <div className="card">
        <div className="g2">
          <div><label>Dari</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label>Sampai</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="kpi" style={{ marginTop: 14 }}>
          <div><b>{total.toLocaleString('id-ID')}</b><span>Total Qty Reject</span></div>
          <div><b>{rows.length}</b><span>Jumlah Input</span></div>
          <div><b>{byItem.length ? new Set(rows.map((r) => r.item_code)).size : 0}</b><span>Item Berbeda</span></div>
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
          <thead><tr><th>Waktu</th><th>WH</th><th>Item</th><th>Qty</th><th>Keterangan</th><th>Foto</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmt(r.created_at)}</td><td>{r.warehouse}</td>
                <td>{r.item_code}<br /><small>{r.item_name}</small></td>
                <td>{r.qty}</td><td>{r.keterangan}</td>
                <td><div className="pics">{r.photos.map((id) => (
                  <a key={id} href={view(id)} target="_blank"><img src={thumb(id)} /></a>))}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
