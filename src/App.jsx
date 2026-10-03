import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import Dashboard from './Dashboard.jsx'
import { uploadPhoto, loadItems } from './drive'
import { WAREHOUSES } from './config'


const compress = (file, max = 1280, q = 0.72) =>
  new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = img.width * s
      c.height = img.height * s
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      c.toBlob(res, 'image/jpeg', q)
    }
    img.src = URL.createObjectURL(file)
  })

export default function App() {
  const [tab, setTab] = useState('input')
  return (
    <div className="wrap">
      <h1>Reject Management</h1>
      <div className="sub">Input dan monitoring item reject</div>
      <div className="tabs">
        <button className={'tab ' + (tab === 'input' ? 'on' : '')} onClick={() => setTab('input')}>Input Reject</button>
        <button className={'tab ' + (tab === 'dash' ? 'on' : '')} onClick={() => setTab('dash')}>Dashboard</button>
      </div>
      {tab === 'input' ? <InputForm /> : <Dashboard />}
    </div>
  )
}

function InputForm() {
  const [items, setItems] = useState([])
  const [wh, setWh] = useState('')
  const [q, setQ] = useState('')
  const [item, setItem] = useState(null)
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState('')
  const [ket, setKet] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    loadItems().then(setItems).catch(() => setMsg({ err: true, t: 'Gagal muat item master (cek link CSV)' }))
  }, [])

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return items.filter((i) => i.code.toLowerCase().includes(s) || i.name.toLowerCase().includes(s)).slice(0, 8)
  }, [q, items])

  const addPhotos = async (e) => {
    const add = await Promise.all([...e.target.files].map(async (f) => {
      const blob = await compress(f)
      return { blob, url: URL.createObjectURL(blob) }
    }))
    setPhotos((p) => [...p, ...add]) // akumulasi, bisa pilih berkali-kali
    e.target.value = ''
  }

  const reset = () => {
    setWh(''); setQ(''); setItem(null); setQty(''); setKet(''); setPhotos([]); setMsg(null)
  }

  const save = async () => {
    if (!wh) return setMsg({ err: true, t: 'Pilih warehouse.' })
    if (!item) return setMsg({ err: true, t: 'Pilih item code dari daftar.' })
    if (!(Number(qty) > 0)) return setMsg({ err: true, t: 'Qty reject harus lebih dari 0.' })
    setBusy(true)
    try {
      const ids = []
      for (let i = 0; i < photos.length; i++) {
        setMsg({ t: `Upload foto ${i + 1}/${photos.length}...` })
        ids.push(await uploadPhoto(photos[i].blob, `${wh}_${item.code}_${Date.now()}_${i + 1}.jpg`))
      }
      const { error } = await supabase.from('rejects').insert({
        warehouse: wh, item_code: item.code, item_name: item.name,
        qty: Number(qty), keterangan: ket.trim() || null, photos: ids,
      })
      if (error) throw error
      reset()
      setMsg({ t: `✓ Reject tersimpan (${ids.length} foto)` })
    } catch (e) {
      setMsg({ err: true, t: 'Gagal: ' + e.message })
    }
    setBusy(false)
  }

  return (
    <div className="card">
      <div className="g2">
        <div>
          <label>Warehouse</label>
          <select value={wh} onChange={(e) => setWh(e.target.value)}>
            <option value="">-- Pilih Warehouse --</option>
            {WAREHOUSES.map((w) => <option key={w}>{w}</option>)}
          </select>
        </div>
        <div className="ac">
          <label>Item Code</label>
          <input
            value={q} placeholder="Ketik item code..."
            onChange={(e) => { setQ(e.target.value); setItem(null); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && matches.length > 0 && (
            <div className="list">
              {matches.map((m) => (
                <div key={m.code} onMouseDown={() => { setItem(m); setQ(m.code); setOpen(false) }}>
                  <b>{m.code}</b> <small>{m.name}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <label>Item Name</label>
      <input readOnly value={item ? item.name : ''} placeholder="Pilih Item Code" />

      <div className="g2">
        <div><label>Qty Reject</label>
          <input type="number" min="1" inputMode="numeric" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><label>Keterangan</label>
          <input placeholder="Keterangan reject" value={ket} onChange={(e) => setKet(e.target.value)} /></div>
      </div>

      <label>Foto Reject</label>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
      <div className="drop" onClick={() => fileRef.current.click()}>
        Klik untuk memilih foto
        <small>Bisa lebih dari 1 foto · Foto akan dikompres otomatis</small>
      </div>
      <div className="prev">
        {photos.map((p, i) => (
          <div className="th" key={i}>
            <img src={p.url} />
            <b onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>×</b>
          </div>
        ))}
      </div>

      <div className="btns">
        <button className="btn dark" disabled={busy} onClick={save}>Simpan Reject</button>
        <button className="btn" disabled={busy} onClick={reset}>Reset</button>
      </div>
      {msg && <div className={'msg ' + (msg.err ? 'err' : 'ok')}>{msg.t}</div>}
    </div>
  )
}
