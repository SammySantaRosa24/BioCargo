import { hashPassword } from '../utils/passwords.js';

export async function seedTestAdmin(pool, { email, password, environment = process.env.NODE_ENV } = {}) {
  if (!['development', 'test'].includes(environment)) {
    throw new Error('O seed de ADMIN so e permitido em development ou test.');
  }

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Defina ADMIN_EMAIL com um endereco valido.');
  }
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Defina ADMIN_PASSWORD com pelo menos 12 caracteres.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(
      'SELECT id, tipo_usuario FROM usuario WHERE email = ? LIMIT 1 FOR UPDATE',
      [normalizedEmail]
    );
    if (existing.length) {
      await connection.rollback();
      return { email: normalizedEmail, result: 'skipped-existing-email' };
    }

    const passwordHash = await hashPassword(password);
    const [created] = await connection.execute(
      "INSERT INTO usuario (email, senha, tipo_usuario, status) VALUES (?, ?, 'ADMIN', TRUE)",
      [normalizedEmail, passwordHash]
    );
    await connection.commit();
    return { email: normalizedEmail, id: created.insertId, result: 'created' };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return { email: normalizedEmail, result: 'skipped-existing-email' };
    throw error;
  } finally {
    connection.release();
  }
}
