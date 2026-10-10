import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { thumbUrls, fullUrls, deletePhotos, loadMaster } from './drive'
import { WAREHOUSES, TINDAKAN } from './config'

function Img({ urls, className, ...rest }) {
  const [k, setK] = useState(0)
  if (k >= urls.length) return <span className={'noimg ' + (className || '')} title="Foto tidak bisa dimuat">!</span>
  return <img src={urls[k]} className={className} referrerPolicy="no-referrer" loading="lazy" onError={() => setK(k + 1)} {...rest} />
}

const splitT = (s) => (s || '').split(/\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean)

const iso = (d) => d.toISOString().slice(0, 10)
const fmt = (s) => new Date(s).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' })

// 3 status checklist: label untuk modal konfirmasi + catatan khusus "ditarik" (auto pindah warehouse)
const FLAG_META = {
  stock_pindah: { label: 'Stock Dipindah (ERP)', note: 'Menandai stok reject ini sudah dipindahkan ke warehouse reject di ERP.' },
  ditarik: { label: 'Sudah Ditarik', note: 'Mencentang: Warehouse otomatis pindah ke "Krembung". Batal centang: Warehouse dikembalikan ke semula.' },
  erp_keluar: { label: 'Keluar dari ERP', note: 'Menandai item reject ini sudah dikeluarkan (write-off) dari ERP.' },
}

export default function Dashboard() {
  const now = new Date()
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(iso(now))
  const [wh, setWh] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [box, setBox] = useState(null) // { ids, i } -> popup foto
  const [opts, setOpts] = useState(TINDAKAN) // daftar tindakan: dari spreadsheet (kolom paling belakang), cadangan config.js
  const [tf, setTf] = useState('') // filter tindakan
  const [tin, setTin] = useState(null) // { id, label }
  const [tinSel, setTinSel] = useState([]) // opsi tercentang (boleh lebih dari 1)
  const [tinOther, setTinOther] = useState('')
  const [tinPin, setTinPin] = useState('')
  const [tinErr, setTinErr] = useState('')
  const [tinBusy, setTinBusy] = useState(false)
  const [del, setDel] = useState(null) // { id, label }
  const [pin, setPin] = useState('')
  const [delErr, setDelErr] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [flag, setFlag] = useState(null) // { id, type, value, label } -> modal centang status
  const [flagPin, setFlagPin] = useState('')
  const [flagErr, setFlagErr] = useState('')
  const [flagBusy, setFlagBusy] = useState(false)

  const openTin = (r) => {
    const toks = splitT(r.tindakan)
    const sel = [], other = []
    toks.forEach((t) => {
      const m = opts.find((o) => o.toLowerCase() === t.toLowerCase())
      m ? sel.push(m) : other.push(t)
    })
    setTin({ id: r.id, label: `${r.item_code} · ${r.qty} · ${fmt(r.created_at)}` })
    setTinSel(sel); setTinOther(other.join(', '))
    setTinPin(''); setTinErr('')
  }

  const toggleSel = (o) => setTinSel((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]))

  const saveTin = async () => {
    const val = [...tinSel, ...splitT(tinOther)].join(', ')
    setTinBusy(true); setTinErr('')
    const { error } = await supabase.rpc('set_tindakan', { p_id: tin.id, p_tindakan: val, p_pin: tinPin })
    setTinBusy(false)
    if (error) return setTinErr(error.message.includes('PIN') ? 'PIN salah' : error.message)
    setTin(null); setTinPin(''); load()
  }

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

  const openFlag = (r, type) => {
    setFlag({ id: r.id, type, value: !r[type], label: `${r.item_code} · ${r.qty} · ${fmt(r.created_at)}` })
    setFlagPin(''); setFlagErr('')
  }

  const doFlag = async () => {
    setFlagBusy(true); setFlagErr('')
    const { error } = await supabase.rpc('set_reject_flag', {
      p_id: flag.id, p_flag: flag.type, p_value: flag.value, p_pin: flagPin,
    })
    setFlagBusy(false)
    if (error) return setFlagErr(error.message.includes('PIN') ? 'PIN salah' : error.message)
    setFlag(null); setFlagPin(''); load()
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
  useEffect(() => { loadMaster().then((m) => m.tindakan.length && setOpts(m.tindakan)).catch(() => {}) }, [])

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

  const shown = useMemo(() => {
    if (!tf) return rows
    if (tf === '__none') return rows.filter((r) => !r.tindakan)
    return rows.filter((r) => splitT(r.tindakan).some((t) => t.toLowerCase() === tf.toLowerCase()))
  }, [rows, tf])

  const { total, items, byWh, byItem } = useMemo(() => {
    const w = {}, i = {}
    let t = 0
    shown.forEach((r) => {
      t += r.qty
      w[r.warehouse] = (w[r.warehouse] || 0) + r.qty
      i[r.item_code] = i[r.item_code] || { code: r.item_code, name: r.item_name, qty: 0 }
      i[r.item_code].qty += r.qty
    })
    const list = Object.values(i).sort((a, b) => b.qty - a.qty)
    return { total: t, items: list.length, byWh: Object.entries(w).sort((a, b) => b[1] - a[1]), byItem: list.slice(0, 10) }
  }, [shown])

  return (
    <>
      <div className="card">
        <div className="g4">
          <div><label>Dari</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label>Sampai</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div><label>Warehouse</label>
            <select value={wh} onChange={(e) => setWh(e.target.value)}>
              <option value="">Semua Warehouse</option>
              {WAREHOUSES.map((w) => <option key={w}>{w}</option>)}
            </select></div>
          <div><label>Tindakan</label>
            <select value={tf} onChange={(e) => setTf(e.target.value)}>
              <option value="">Semua</option>
              <option value="__none">Belum diisi</option>
              {opts.map((t) => <option key={t}>{t}</option>)}
            </select></div>
        </div>
        <div className="kpi" style={{ marginTop: 14 }}>
          <div><b>{total.toLocaleString('id-ID')}</b><span>Total Qty Reject</span></div>
          <div><b>{shown.length}</b><span>Jumlah Input</span></div>
          <div><b>{items}</b><span>Item Berbeda</span></div>
          <div><b>{shown.filter((r) => !r.tindakan).length}</b><span>Belum Ditindak</span></div>
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
          <thead><tr><th>Waktu</th><th>WH</th><th>Item</th><th>Qty</th><th>Keterangan</th><th>Tindakan</th><th>Foto</th>
            <th title={FLAG_META.stock_pindah.note}>Stock ERP</th>
            <th title={FLAG_META.ditarik.note}>Ditarik</th>
            <th title={FLAG_META.erp_keluar.note}>Keluar ERP</th>
            <th></th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{fmt(r.created_at)}</td><td>{r.warehouse}</td>
                <td>{r.item_code}<br /><small>{r.item_name}</small></td>
                <td>{r.qty}</td><td>{r.keterangan}</td>
                <td>{r.tindakan ? splitT(r.tindakan).map((t) => <span key={t} className="chip">{t}</span>) : <span className="tag">Belum diisi</span>}</td>
                <td><div className="pics">{r.photos.map((id, i) => (
                  <Img key={id} urls={thumbUrls(id)} onClick={() => setBox({ ids: r.photos, i })} />))}</div></td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!r.stock_pindah} title={r.stock_pindah_at ? fmt(r.stock_pindah_at) : ''} onChange={() => openFlag(r, 'stock_pindah')} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!r.ditarik} title={r.ditarik_at ? fmt(r.ditarik_at) : ''} onChange={() => openFlag(r, 'ditarik')} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!r.erp_keluar} title={r.erp_keluar_at ? fmt(r.erp_keluar_at) : ''} onChange={() => openFlag(r, 'erp_keluar')} />
                </td>
                <td><div className="acts"><button className="ed" onClick={() => openTin(r)}>Action</button><button className="del" onClick={() => { setDel({ id: r.id, photos: r.photos, label: `${r.item_code} · ${r.qty} · ${fmt(r.created_at)}` }); setPin(''); setDelErr('') }}>Hapus</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tin && (
        <div className="lb" onClick={() => setTin(null)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <b>Action · Instruksi tindakan (admin)</b>
            <p>{tin.label}</p>
            <div className="chk">
              {opts.map((o) => (
                <label key={o}><input type="checkbox" checked={tinSel.includes(o)} onChange={() => toggleSel(o)} /> {o}</label>
              ))}
            </div>
            <input style={{ marginTop: 8 }} placeholder="Lainnya (opsional, pisahkan dengan koma)" value={tinOther} onChange={(e) => setTinOther(e.target.value)} />
            <input style={{ marginTop: 8 }} type="password" placeholder="PIN admin" value={tinPin}
              onChange={(e) => setTinPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tinPin && saveTin()} />
            {tinErr && <div className="msg err">{tinErr}</div>}
            <div className="btns">
              <button className="btn dark" disabled={tinBusy || !tinPin} onClick={saveTin}>Simpan</button>
              <button className="btn" onClick={() => setTin(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}

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

      {flag && (
        <div className="lb" onClick={() => setFlag(null)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <b>{FLAG_META[flag.type].label} · {flag.value ? 'Tandai' : 'Batalkan tanda'}</b>
            <p>{flag.label}</p>
            <small style={{ color: '#888' }}>{FLAG_META[flag.type].note}</small>
            <input style={{ marginTop: 8 }} type="password" placeholder="PIN admin" value={flagPin} autoFocus
              onChange={(e) => setFlagPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && flagPin && doFlag()} />
            {flagErr && <div className="msg err">{flagErr}</div>}
            <div className="btns">
              <button className="btn dark" disabled={flagBusy || !flagPin} onClick={doFlag}>{flag.value ? 'Tandai' : 'Batalkan'}</button>
              <button className="btn" onClick={() => setFlag(null)}>Batal</button>
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
