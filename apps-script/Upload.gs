// Script MANDIRI (bukan di dalam spreadsheet). Hanya menerima foto lalu menyimpannya ke Drive.
const FOLDER_ID = 'ISI_ID_FOLDER_DRIVE';
const SECRET = 'ISI_KUNCI_ACAK'; // harus sama dengan VITE_UPLOAD_KEY

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.key !== SECRET) return out({ error: 'unauthorized' });
    const blob = Utilities.newBlob(Utilities.base64Decode(d.data), 'image/jpeg', d.name);
    const f = DriveApp.getFolderById(FOLDER_ID).createFile(blob);
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) {}
    return out({ id: f.getId() });
  } catch (err) {
    return out({ error: String(err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
