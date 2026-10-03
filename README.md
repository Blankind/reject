# Reject App (React + Supabase + Google Drive)

## 1. Supabase
SQL Editor → jalankan supabase.sql. Settings → API → salin URL + anon key.

## 2. Upload ke Google Drive (tanpa OAuth/Cloud Console)
1. Drive: buat folder "Reject Foto" → salin ID dari URL (setelah /folders/).
2. script.google.com → New project (BUKAN dari spreadsheet) → tempel apps-script/Upload.gs.
3. Isi FOLDER_ID dan SECRET.
4. Deploy → New deployment → Web app → Execute as: **Me** → Who has access: **Anyone** → Deploy → izinkan akses Drive.
5. Salin URL web app (berakhir /exec) → VITE_UPLOAD_URL.
Setiap ubah kode script: Deploy → Manage deployments → Edit → New version.

## 3. Item master
Spreadsheet → File → Share → Publish to web → tab Item → CSV → salin link → VITE_ITEM_CSV_URL.
Kolom A = item code, B = item name, baris 1 = header.

## 4. Jalankan
cp .env.example .env  (isi 5 nilai) → npm install → npm run dev
Deploy: Vercel/Netlify dengan 5 env yang sama. Warehouse: edit WAREHOUSES di src/App.jsx.
