export function decodeSpreadsheetText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export async function readSpreadsheetFile(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return decodeSpreadsheetText(bytes);
}
