/**
 * Reads `{{placeholder}}` tokens from a .docx file entirely in the browser.
 * Mock-only helper: in production the FastAPI backend parses templates
 * (e.g. with docxtpl / python-docx) and returns the detected schema.
 */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Extract text of the given entries from a zip archive (docx = zip). */
async function readZipEntries(buf: ArrayBuffer, match: (name: string) => boolean): Promise<string[]> {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  // Find End Of Central Directory record.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .docx (zip) file");
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const out: string[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;
    if (!match(name)) continue;
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(start, start + compSize);
    const data = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    if (data) out.push(decoder.decode(data));
  }
  return out;
}

/** Returns unique placeholder names found in the document body/headers. */
export async function detectDocxPlaceholders(file: File): Promise<string[]> {
  if (typeof DecompressionStream === "undefined") return [];
  const xmls = await readZipEntries(await file.arrayBuffer(), (n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n));
  const found = new Set<string>();
  for (const xml of xmls) {
    // Word splits runs, so strip tags before matching.
    const text = xml.replace(/<[^>]+>/g, "");
    for (const m of text.matchAll(/\{\{\s*([#/]?)\s*([a-zA-Z_][\w.]*)\s*\}\}|\{%\s*for\s+\w+\s+in\s+([a-zA-Z_]\w*)\s*%\}/g)) {
      const name = m[2] ?? m[3];
      if (name && !m[1]) found.add(name.split(".")[0]);
      if (m[3]) found.add(m[3]);
    }
  }
  return [...found];
}
