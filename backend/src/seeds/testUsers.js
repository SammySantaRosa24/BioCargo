import { isValidCnpj, isValidCpf, normalizeCnpj, normalizeCpf } from '../utils/brazilianDocuments.js';
import { hashPassword } from '../utils/passwords.js';

export const TEST_USERS = [
  {
    email: 'empresa.teste@biocargo.local',
    password: 'BioCargo@123',
    type: 'EMPRESA',
    cnpj: '00000000000191',
    razaoSocial: 'Empresa Teste BioCargo',
    nomeFantasia: 'Conta local de teste',
  },
  {
    email: 'motorista.teste@biocargo.local',
    password: 'BioCargo@123',
    type: 'MOTORISTA',
    cnpj: '00000000000272',
    cpf: '00000000191',
    nome: 'Motorista Teste BioCargo',
  },
];

export async function seedTestUsers(pool) {
  const results = [];

  for (const testUser of TEST_USERS) {
    const cnpj = normalizeCnpj(testUser.cnpj);
    if (!isValidCnpj(cnpj)) throw new Error(`CNPJ inválido configurado para ${testUser.email}.`);
    if (testUser.cpf && !isValidCpf(normalizeCpf(testUser.cpf))) {
      throw new Error(`CPF inválido configurado para ${testUser.email}.`);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingUsers] = await connection.execute(
        'SELECT id FROM usuario WHERE email = ? LIMIT 1', [testUser.email]
      );
      if (existingUsers.length) {
        await connection.rollback();
        results.push({ email: testUser.email, result: 'skipped-existing-email' });
        continue;
      }

      const [existingCnpjs] = await connection.execute(
        `SELECT id FROM empresa WHERE cnpj = ?
         UNION ALL SELECT id FROM motorista WHERE cnpj = ? LIMIT 1`,
        [cnpj, cnpj]
      );
      if (existingCnpjs.length) {
        await connection.rollback();
        results.push({ email: testUser.email, result: 'skipped-existing-cnpj' });
        continue;
      }

      if (testUser.cpf) {
        const [existingCpfs] = await connection.execute(
          'SELECT id FROM motorista WHERE cpf = ? LIMIT 1', [normalizeCpf(testUser.cpf)]
        );
        if (existingCpfs.length) {
          await connection.rollback();
          results.push({ email: testUser.email, result: 'skipped-existing-cpf' });
          continue;
        }
      }

      const passwordHash = await hashPassword(testUser.password);
      const [userResult] = await connection.execute(
        'INSERT INTO usuario (email, senha, tipo_usuario) VALUES (?, ?, ?)',
        [testUser.email, passwordHash, testUser.type]
      );

      if (testUser.type === 'EMPRESA') {
        await connection.execute(
          `INSERT INTO empresa (usuario_id, razao_social, nome_fantasia, cnpj)
           VALUES (?, ?, ?, ?)`,
          [userResult.insertId, testUser.razaoSocial, testUser.nomeFantasia, cnpj]
        );
      } else {
        await connection.execute(
          `INSERT INTO motorista (usuario_id, nome, cpf, cnpj)
           VALUES (?, ?, ?, ?)`,
          [userResult.insertId, testUser.nome, normalizeCpf(testUser.cpf), cnpj]
        );
      }

      await connection.commit();
      results.push({ email: testUser.email, result: 'created' });
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') {
        results.push({ email: testUser.email, result: 'skipped-existing-unique-value' });
        continue;
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  return results;
}
