import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, salt, hash] = String(storedHash ?? '').split(':');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;

  const expectedHash = Buffer.from(hash, 'hex');
  const derivedKey = await scrypt(password, salt, expectedHash.length);
  return expectedHash.length === derivedKey.length && timingSafeEqual(expectedHash, derivedKey);
}
