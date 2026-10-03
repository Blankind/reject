import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const JENIS = ['Cacat Visual', 'Dimensi', 'Bocor', 'Kotor', 'Rusak', 'Lainnya']
const today = () => new Date().toISOString().slice(0, 10)
const empty = { tanggal: today(), shift: '1', line: '', produk: '', jenis: JENIS[0], qty: '', keterangan: '' }

// kompres gambar -> Blob JPEG (maks 1280px)
const compress = (file, max = 1280, q = 0.72) =>
  new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = img.width * s
      c.height = img.height * s
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      c.toBlob((b) => res(b), 'image/jpeg', q)
    }
    img.src = URL.createObjectURL(file)
  })

const toBase64 = (blob) =>
  new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.readAsDataURL(blob)
  })
const thumb = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w200`
const view = (id) => `https://drive.google.com/file/d/${id}/view`

export default function App() {
  const [f, setF] = useState(empty)
  const [photos, setPhotos] = useState([]) // [{blob, url}]
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef()

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const load = async () => {
    const { data } = await supabase.from('rejects').select('*').order('id', { ascending: false }).limit(20)
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const addPhotos = async (e) => {
    const items = await Promise.all(
      [...e.target.files].map(async (file) => {
        const blob = await compress(file)
        return { blob, url: URL.createObjectURL(blob) }
      })
    )
    setPhotos((p) => [...p, ...items])
    e.target.value = ''
  }

  const submit = async () => {
    if (!f.line || !f.produk || !f.qty) return setMsg('Line, produk, qty wajib diisi.')
    setBusy(true)
    setMsg('Menyimpan...')
    try {
      const urls = []
      for (let i = 0; i < photos.length; i++) {
        setMsg(`Upload foto ${i + 1}/${photos.length}...`)
        const r = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_UPLOAD_KEY },
          body: JSON.stringify({ name: `${f.tanggal}_${f.line}_${Date.now()}_${i + 1}.jpg`, data: await toBase64(photos[i].blob) }),
        })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error)
        urls.push(j.id)
      }
      const { error } = await supabase.from('rejects').insert({
        ...f, qty: Number(f.qty), photos: urls,
      })
      if (error) throw error
      setMsg(`✓ Tersimpan (${urls.length} foto)`)
      setF({ ...empty, tanggal: f.tanggal, shift: f.shift, line: f.line })
      setPhotos([])
      load()
    } catch (err) {
      setMsg('Gagal: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div className="wrap">
      <h1>Reject Management</h1>
      <div className="card">
        <div className="row">
          <div><label>Tanggal</label><input type="date" value={f.tanggal} onChange={set('tanggal')} /></div>
          <div><label>Shift</label>
            <select value={f.shift} onChange={set('shift')}>
              <option>1</option><option>2</option><option>3</option>
            </select></div>
        </div>
        <label>Line / Mesin</label><input value={f.line} onChange={set('line')} />
        <label>Produk</label><input value={f.produk} onChange={set('produk')} />
        <div className="row">
          <div><label>Jenis Reject</label>
            <select value={f.jenis} onChange={set('jenis')}>{JENIS.map((j) => <option key={j}>{j}</option>)}</select></div>
          <div><label>Qty</label><input type="number" min="1" inputMode="numeric" value={f.qty} onChange={set('qty')} /></div>
        </div>
        <label>Keterangan</label><textarea rows="3" value={f.keterangan} onChange={set('keterangan')} />

        <label>Foto (bisa banyak)</label>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
        <button type="button" className="add" onClick={() => fileRef.current.click()}>+ Tambah Foto</button>
        <div className="prev">
          {photos.map((p, i) => (
            <div className="th" key={i}>
              <img src={p.url} />
              <b onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>×</b>
            </div>
          ))}
        </div>

        <button disabled={busy} onClick={submit}>Simpan</button>
        <div className="msg">{msg}</div>
      </div>

      <div className="card">
        <b>20 input terakhir</b>
        <table>
          <thead><tr><th>Tgl</th><th>Line</th><th>Produk</th><th>Jenis</th><th>Qty</th><th>Foto</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.tanggal}</td><td>{r.line}</td><td>{r.produk}</td><td>{r.jenis}</td><td>{r.qty}</td>
                <td><div className="pics">{(r.photos || []).map((u) => (
                  <a key={u} href={view(u)} target="_blank"><img src={thumb(u)} /></a>))}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
