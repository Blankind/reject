// Script MANDIRI (bukan di dalam spreadsheet). Upload foto + hapus foto di folder Drive.
const FOLDER_ID = '1uQNl36poywwytAkPWHtdmnC6vpXQof-R';
const SECRET = 'rj-8f3k29xq'; // harus sama dengan VITE_UPLOAD_KEY

// Cek versi: buka URL /exec di browser. Harus tampil {"ok":true,"version":"v3-delete"}.
function doGet() {
  return out({ ok: true, version: 'v3-delete' });
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.key !== SECRET) return out({ error: 'unauthorized' });

    if (d.action === 'delete') return out(deleteFiles_(d.ids || []));

    const blob = Utilities.newBlob(Utilities.base64Decode(d.data), 'image/jpeg', d.name);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) {}
    const f = folder.createFile(blob);
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) {}
    return out({ id: f.getId() });
  } catch (err) {
    return out({ error: String(err) });
  }
}

// Hanya file di dalam folder Reject Foto yang boleh dihapus. Masuk Trash (bisa dipulihkan 30 hari).
function deleteFiles_(ids) {
  let n = 0;
  ids.forEach(function (id) {
    try {
      const f = DriveApp.getFileById(id);
      const parents = f.getParents();
      while (parents.hasNext()) {
        if (parents.next().getId() === FOLDER_ID) { f.setTrashed(true); n++; break; }
      }
    } catch (x) {}
  });
  return { deleted: n };
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
