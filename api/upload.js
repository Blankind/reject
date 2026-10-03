import { google } from 'googleapis'
import { Readable } from 'stream'

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (req.headers['x-api-key'] !== process.env.UPLOAD_KEY) return res.status(401).json({ error: 'unauthorized' })

  try {
    const { name, data } = req.body // data = base64 JPEG tanpa prefix
    const auth = new google.auth.OAuth2(process.env.G_CLIENT_ID, process.env.G_CLIENT_SECRET)
    auth.setCredentials({ refresh_token: process.env.G_REFRESH_TOKEN })
    const drive = google.drive({ version: 'v3', auth })

    const file = await drive.files.create({
      requestBody: { name, parents: [process.env.DRIVE_FOLDER_ID] },
      media: { mimeType: 'image/jpeg', body: Readable.from(Buffer.from(data, 'base64')) },
      fields: 'id',
    })
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    })
    res.json({ id: file.data.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
