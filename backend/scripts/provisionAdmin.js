import 'dotenv/config';
import pool from '../src/config/database.js';
import { hashPassword } from '../src/utils/passwords.js';

async function main() {
  if (!['development', 'test'].includes(process.env.NODE_ENV)) {
    throw new Error('O provisionamento de ADMIN só é permitido em development ou test.');
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Defina ADMIN_EMAIL com um endereço válido.');
  if (!password || password.length < 12) throw new Error('Defina ADMIN_PASSWORD com pelo menos 12 caracteres.');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id, tipo_usuario FROM usuario WHERE email = ? LIMIT 1 FOR UPDATE', [email]);
    if (existing.length) throw new Error('Esse e-mail já existe. O provisionamento não promove contas existentes.');
    const passwordHash = await hashPassword(password);
    const [created] = await connection.execute(
      "INSERT INTO usuario (email, senha, tipo_usuario, status) VALUES (?, ?, 'ADMIN', TRUE)",
      [email, passwordHash]
    );
    await connection.commit();
    process.stdout.write(`Administrador de desenvolvimento criado (id ${created.insertId}, ${email}).\n`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
