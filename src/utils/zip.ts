/**
 * Minimal ZIP file creator (uncompressed/stored) – zero dependencies.
 * Produces a valid .zip that any standard tool can open.
 */

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function createZipBlob(files: { path: string; content: string }[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);

    // Local file header (30 bytes + filename)
    const local = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(local);
    lv.setUint32(0, 0x04034b50, true);          // signature
    lv.setUint16(4, 20, true);                   // version needed
    lv.setUint16(6, 0, true);                    // flags
    lv.setUint16(8, 0, true);                    // compression: store
    lv.setUint16(10, 0, true);                   // mod time
    lv.setUint16(12, 0, true);                   // mod date
    lv.setUint32(14, crc, true);                 // crc-32
    lv.setUint32(18, dataBytes.length, true);    // compressed size
    lv.setUint32(22, dataBytes.length, true);    // uncompressed size
    lv.setUint16(26, nameBytes.length, true);    // filename length
    lv.setUint16(28, 0, true);                   // extra field length
    new Uint8Array(local).set(nameBytes, 30);

    localParts.push(new Uint8Array(local));
    localParts.push(dataBytes);

    // Central directory header (46 bytes + filename)
    const central = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(central);
    cv.setUint32(0, 0x02014b50, true);           // signature
    cv.setUint16(4, 20, true);                   // version made by
    cv.setUint16(6, 20, true);                   // version needed
    cv.setUint16(8, 0, true);                    // flags
    cv.setUint16(10, 0, true);                   // compression
    cv.setUint16(12, 0, true);                   // mod time
    cv.setUint16(14, 0, true);                   // mod date
    cv.setUint32(16, crc, true);                 // crc-32
    cv.setUint32(20, dataBytes.length, true);    // compressed size
    cv.setUint32(24, dataBytes.length, true);    // uncompressed size
    cv.setUint16(28, nameBytes.length, true);    // filename length
    cv.setUint16(30, 0, true);                   // extra field length
    cv.setUint16(32, 0, true);                   // comment length
    cv.setUint16(34, 0, true);                   // disk number start
    cv.setUint16(36, 0, true);                   // internal attributes
    cv.setUint32(38, 0, true);                   // external attributes
    cv.setUint32(42, offset, true);              // relative offset of local header
    new Uint8Array(central).set(nameBytes, 46);

    centralParts.push(new Uint8Array(central));
    offset += 30 + nameBytes.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);

  // End of central directory record (22 bytes)
  const end = new ArrayBuffer(22);
  const ev = new DataView(end);
  ev.setUint32(0, 0x06054b50, true);             // signature
  ev.setUint16(4, 0, true);                      // disk number
  ev.setUint16(6, 0, true);                      // central dir disk
  ev.setUint16(8, files.length, true);            // entries on this disk
  ev.setUint16(10, files.length, true);           // total entries
  ev.setUint32(12, centralSize, true);            // central dir size
  ev.setUint32(16, offset, true);                 // central dir offset
  ev.setUint16(20, 0, true);                      // comment length

  return new Blob([...localParts, ...centralParts, new Uint8Array(end)] as BlobPart[], {
    type: 'application/zip',
  });
}
