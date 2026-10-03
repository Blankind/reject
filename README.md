# Reject App (React + Supabase + Google Drive)

## 1. Supabase
Jalankan supabase.sql. Kolom `photos` menyimpan array ID file Drive.

## 2. Google Cloud (sekali saja)
1. console.cloud.google.com → project baru → enable **Google Drive API**.
2. OAuth consent screen → External → isi nama app → **Publish app (In production)**.
   (Mode Testing: refresh token kedaluwarsa 7 hari.)
3. Credentials → Create **OAuth client ID** → Web application →
   Authorized redirect URI: https://developers.google.com/oauthplayground
4. https://developers.google.com/oauthplayground → ikon gear → centang
   "Use your own OAuth credentials" → isi Client ID + Secret.
5. Step 1: pilih scope `https://www.googleapis.com/auth/drive` → Authorize
   (login dengan akun pemilik Drive) → Step 2: Exchange → salin **Refresh token**.
6. Di Drive buat folder "Reject Foto" → ID = bagian akhir URL folder.

## 3. Jalankan
cp .env.example .env  (isi semua)
npm install
npx vercel dev        # lokal (API + React)
npx vercel --prod     # deploy; isi env di dashboard Vercel
