import express from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function validPng(bytes) {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  let offset = 8;
  let header = null;
  let seenData = false;
  let seenEnd = false;
  let seenPalette = false;
  let dataEnded = false;
  const dataChunks = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (length > MAX_IMAGE_BYTES || offset + 12 + length > bytes.length) return false;
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const chunkData = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== expectedCrc) return false;
    if (!header && type !== 'IHDR') return false;
    if (type === 'IHDR') {
      if (header || length !== 13) return false;
      header = {
        width: chunkData.readUInt32BE(0), height: chunkData.readUInt32BE(4),
        depth: chunkData[8], color: chunkData[9], compression: chunkData[10],
        filter: chunkData[11], interlace: chunkData[12],
      };
      if (!header.width || !header.height || header.width * header.height > 40_000_000 || header.compression !== 0 || header.filter !== 0 || header.interlace > 1) return false;
      const allowedDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!allowedDepths[header.color]?.includes(header.depth)) return false;
    } else if (type === 'IDAT') {
      if (seenEnd || dataEnded || (header.color === 3 && !seenPalette)) return false;
      seenData = true;
      dataChunks.push(chunkData);
    } else if (type === 'PLTE') {
      if (seenPalette || seenData || length < 3 || length > 768 || length % 3 || [0, 4].includes(header.color)) return false;
      seenPalette = true;
    } else if (type === 'IEND') {
      if (length !== 0 || !seenData || offset + 12 !== bytes.length) return false;
      seenEnd = true;
      break;
    } else {
      if (seenData) dataEnded = true;
      if (/^[A-Z]/.test(type)) return false;
    }
    offset += 12 + length;
  }
  if (!header || !seenData || !seenEnd) return false;
  try {
    const raw = inflateSync(Buffer.concat(dataChunks), { maxOutputLength: 64 * 1024 * 1024 });
    const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[header.color];
    const bitsPerPixel = channels * header.depth;
    const passes = header.interlace === 0
      ? [[0, 0, 1, 1]]
      : [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
    let expectedSize = 0;
    const rowOffsets = [];
    for (const [startX, startY, stepX, stepY] of passes) {
      const width = Math.max(0, Math.ceil((header.width - startX) / stepX));
      const height = Math.max(0, Math.ceil((header.height - startY) / stepY));
      if (!width || !height) continue;
      const rowSize = Math.ceil(width * bitsPerPixel / 8);
      for (let row = 0; row < height; row += 1) {
        rowOffsets.push(expectedSize);
        expectedSize += 1 + rowSize;
      }
    }
    return raw.length === expectedSize && rowOffsets.every((row) => raw[row] <= 4);
  } catch { return false; }
}

function validJpeg(bytes) {
  if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return false;
  let offset = 2;
  let hasFrame = false;
  while (offset < bytes.length - 2) {
    if (bytes[offset] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) return hasFrame && offset === bytes.length;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return false;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return false;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8 || bytes.readUInt16BE(offset + 3) === 0 || bytes.readUInt16BE(offset + 5) === 0) return false;
      hasFrame = true;
    }
    if (marker === 0xda) return hasFrame && length >= 6 && offset + length < bytes.length - 2;
    offset += length;
  }
  return false;
}

export function inspectPrivateImage(file) {
  if (!file || !Buffer.isBuffer(file.bytes) || file.bytes.length > MAX_IMAGE_BYTES) return null;
  if (file.mime === 'image/png' && validPng(file.bytes)) return { mime: 'image/png', extension: 'png' };
  if (['image/jpeg', 'image/jpg', 'image/pjpeg'].includes(file.mime) && validJpeg(file.bytes)) return { mime: 'image/jpeg', extension: 'jpg' };
  return null;
}

export function parseMultipartBody(buffer, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.slice(1).find(Boolean)?.trim();
  if (!boundary || boundary.length > 200 || !Buffer.isBuffer(buffer)) return { error: 'Envie um formulário multipart válido.' };
  const delimiter = Buffer.from(`--${boundary}`);
  const result = {};
  let cursor = buffer.indexOf(delimiter);
  if (cursor < 0) return { error: 'Formulário multipart inválido.' };
  while (cursor >= 0) {
    cursor += delimiter.length;
    if (buffer.subarray(cursor, cursor + 2).toString() === '--') break;
    if (buffer.subarray(cursor, cursor + 2).toString() === '\r\n') cursor += 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd < 0) return { error: 'Cabeçalho multipart inválido.' };
    const headers = buffer.subarray(cursor, headerEnd).toString('latin1');
    const name = /(?:^|;)\s*name="([^"\r\n]+)"/i.exec(headers)?.[1];
    if (!name || Object.hasOwn(result, name)) return { error: 'Campo multipart ausente ou duplicado.' };
    const valueStart = headerEnd + 4;
    const next = buffer.indexOf(delimiter, valueStart);
    if (next < 0) return { error: 'Final do formulário multipart ausente.' };
    let valueEnd = next;
    if (buffer.subarray(valueEnd - 2, valueEnd).toString() === '\r\n') valueEnd -= 2;
    const bytes = buffer.subarray(valueStart, valueEnd);
    if (/filename="[^"]*"/i.test(headers)) {
      const mime = /(?:^|\r\n)content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim().toLowerCase();
      result[name] = { bytes, mime };
    } else result[name] = bytes.toString('utf8');
    cursor = next;
  }
  return { fields: result };
}

export function optionalMultipartRaw(limit = '6mb') {
  return (req, res, next) => {
    const type = req.headers['content-type'] || '';
    if (!type.toLowerCase().startsWith('multipart/form-data;')) return next();
    express.raw({ type: 'multipart/form-data', limit })(req, res, (error) => {
      if (error) return res.status(error.status === 413 ? 413 : 400).json({ message: error.status === 413 ? 'O formulário excede o tamanho permitido.' : 'Não foi possível ler o formulário enviado.' });
      next();
    });
  };
}

export async function storePrivateImage(file, storageDir, image = inspectPrivateImage(file)) {
  if (!image) throw new Error('INVALID_IMAGE');
  await mkdir(storageDir, { recursive: true });
  const filename = `${randomUUID()}.${image.extension}`;
  await writeFile(path.join(storageDir, filename), file.bytes, { flag: 'wx', mode: 0o600 });
  return { filename, mime: image.mime, size: file.bytes.length, path: path.join(storageDir, filename) };
}

export async function removePrivateFile(filePath) {
  await rm(filePath, { force: true });
}
