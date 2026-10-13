import { useEffect, useState } from 'react';

// Input desimal. Terima titik atau koma, simpan string selama mengetik.
// value    : number | null  (dari state induk)
// onChange : (number | null) => void
export default function DecimalInput({ value, onChange, ...props }) {
  const [text, setText] = useState(value == null ? '' : String(value));

  // sinkron kalau value dari luar berubah (reset form, load data)
  useEffect(() => {
    const parsed = parseFloat(text.replace(',', '.'));
    const same = (Number.isNaN(parsed) ? null : parsed) === (value ?? null);
    if (!same) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value.replace(',', '.');
    if (!/^\d*\.?\d*$/.test(v)) return; // tolak huruf/simbol lain
    setText(v);
    const n = parseFloat(v);
    onChange(Number.isNaN(n) ? null : n);
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
    />
  );
}

/* Pakai (ganti input float lama di App.jsx):

   import DecimalInput from './DecimalInput';

   <DecimalInput
     value={form.qty}
     onChange={(n) => setForm({ ...form, qty: n })}
     placeholder="0.0"
   />

   Pastikan kolom di Supabase bertipe numeric / float8, bukan int.
*/
