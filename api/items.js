import { google } from 'googleapis'

let cache = { at: 0, data: [] }
const TTL = 5 * 60 * 1000

export default async function handler(req, res) {
  if (req.headers['x-api-key'] !== process.env.UPLOAD_KEY) return res.status(401).json({ error: 'unauthorized' })
  try {
    if (Date.now() - cache.at > TTL) {
      const auth = new google.auth.OAuth2(process.env.G_CLIENT_ID, process.env.G_CLIENT_SECRET)
      auth.setCredentials({ refresh_token: process.env.G_REFRESH_TOKEN })
      const sheets = google.sheets({ version: 'v4', auth })
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.ITEM_SHEET_ID,
        range: process.env.ITEM_RANGE || 'A2:B', // A = item code, B = item name, baris 1 = header; tanpa nama tab = tab pertama
      })
      cache = {
        at: Date.now(),
        data: (r.data.values || [])
          .filter((v) => v[0])
          .map((v) => ({ code: String(v[0]).trim(), name: String(v[1] || '').trim() })),
      }
    }
    res.json(cache.data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
