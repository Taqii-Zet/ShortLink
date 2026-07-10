import crypto from 'crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const check = crypto.createHash('sha256').update(salt + password).digest('hex');
  return check === hash;
}