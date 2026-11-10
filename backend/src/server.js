import 'dotenv/config';
import express from 'express';
import pool from './config/database.js';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';

const app = express();
const PORT = process.env.PORT || 3000;
const scrypt = promisify(scryptCallback);
const MySQLStore = MySQLStoreFactory(session);

app.use(express.json());

// Sessões armazenadas no MySQL
const sessionStore = new MySQLStore({}, pool);

app.use(session({
  name: 'biocargo.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// Gera o hash da senha
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);

  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

// Verifica a senha
async function verifyPassword(password, storedHash) {
  const [algorithm, salt, hash] = storedHash.split(':');

  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const expectedHash = Buffer.from(hash, 'hex');
  const derivedKey = await scrypt(password, salt, expectedHash.length);

  return expectedHash.length === derivedKey.length &&
    timingSafeEqual(expectedHash, derivedKey);
}

// Cadastro de empresa
app.post('/api/v1/auth/register/company', async (req, res) => {
  const {
    razaoSocial,
    nomeFantasia,
    cnpj,
    telefone,
    email,
    senha
  } = req.body;

  if (
    typeof razaoSocial !== 'string' || !razaoSocial.trim() ||
    typeof cnpj !== 'string' || !cnpj.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof senha !== 'string' || !senha
  ) {
    return res.status(400).json({
      message: 'Preencha todos os campos obrigatórios.'
    });
  }

  const emailNormalizado = email.trim().toLowerCase();
  const cnpjNormalizado = cnpj.trim();

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [usuarios] = await connection.execute(
      'SELECT id FROM usuario WHERE email = ?',
      [emailNormalizado]
    );

    if (usuarios.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Este e-mail já está cadastrado.'
      });
    }

    const [cnpjs] = await connection.execute(
      `SELECT id FROM empresa WHERE cnpj = ?
       UNION ALL
       SELECT id FROM motorista WHERE cnpj = ?
       LIMIT 1`,
      [cnpjNormalizado, cnpjNormalizado]
    );

    if (cnpjs.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Este CNPJ já está cadastrado.'
      });
    }

    const senhaHash = await hashPassword(senha);

    const [usuarioResult] = await connection.execute(
      `INSERT INTO usuario (email, senha, tipo_usuario)
       VALUES (?, ?, 'EMPRESA')`,
      [emailNormalizado, senhaHash]
    );

    const [empresaResult] = await connection.execute(
      `INSERT INTO empresa (
        usuario_id, razao_social, nome_fantasia, cnpj, telefone
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        usuarioResult.insertId,
        razaoSocial.trim(),
        nomeFantasia?.trim() || null,
        cnpjNormalizado,
        telefone?.trim() || null
      ]
    );

    await connection.commit();

    return res.status(201).json({
      data: {
        usuario: {
          id: usuarioResult.insertId,
          tipoUsuario: 'EMPRESA'
        },
        empresa: {
          id: empresaResult.insertId
        }
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'E-mail ou CNPJ já cadastrado.'
      });
    }

    console.error('Erro ao cadastrar empresa:', error.message);

    return res.status(500).json({
      message: 'Não foi possível realizar o cadastro.'
    });

  } finally {
    if (connection) connection.release();
  }
});

// Cadastro de motorista PJ
app.post('/api/v1/auth/register/driver', async (req, res) => {
  const {
    nomeCompleto,
    cpf,
    cnpj,
    telefone,
    email,
    senha
  } = req.body;

  if (
    typeof nomeCompleto !== 'string' || !nomeCompleto.trim() ||
    typeof cpf !== 'string' || !cpf.trim() ||
    typeof cnpj !== 'string' || !cnpj.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof senha !== 'string' || !senha
  ) {
    return res.status(400).json({
      message: 'Preencha todos os campos obrigatórios.'
    });
  }

  const emailNormalizado = email.trim().toLowerCase();
  const cpfNormalizado = cpf.trim();
  const cnpjNormalizado = cnpj.trim();

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [usuarios] = await connection.execute(
      'SELECT id FROM usuario WHERE email = ?',
      [emailNormalizado]
    );

    if (usuarios.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Este e-mail já está cadastrado.'
      });
    }

    const [documentos] = await connection.execute(
      `SELECT id FROM motorista WHERE cpf = ? OR cnpj = ?
       UNION ALL
       SELECT id FROM empresa WHERE cnpj = ?
       LIMIT 1`,
      [cpfNormalizado, cnpjNormalizado, cnpjNormalizado]
    );

    if (documentos.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: 'CPF ou CNPJ já cadastrado.'
      });
    }

    const senhaHash = await hashPassword(senha);

    const [usuarioResult] = await connection.execute(
      `INSERT INTO usuario (email, senha, tipo_usuario)
       VALUES (?, ?, 'MOTORISTA')`,
      [emailNormalizado, senhaHash]
    );

    const [motoristaResult] = await connection.execute(
      `INSERT INTO motorista (
        usuario_id, nome, cpf, cnpj, telefone
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        usuarioResult.insertId,
        nomeCompleto.trim(),
        cpfNormalizado,
        cnpjNormalizado,
        telefone?.trim() || null
      ]
    );

    await connection.commit();

    return res.status(201).json({
      data: {
        usuario: {
          id: usuarioResult.insertId,
          tipoUsuario: 'MOTORISTA'
        },
        motorista: {
          id: motoristaResult.insertId
        }
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'E-mail, CPF ou CNPJ já cadastrado.'
      });
    }

    console.error('Erro ao cadastrar motorista:', error.message);

    return res.status(500).json({
      message: 'Não foi possível realizar o cadastro.'
    });

  } finally {
    if (connection) connection.release();
  }
});

// Login
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, senha } = req.body;

  if (
    typeof email !== 'string' || !email.trim() ||
    typeof senha !== 'string' || !senha
  ) {
    return res.status(400).json({
      message: 'Informe o e-mail e a senha.'
    });
  }

  try {
    const [usuarios] = await pool.execute(
      `SELECT id, email, senha, tipo_usuario, status
       FROM usuario
       WHERE email = ?
       LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        message: 'E-mail ou senha incorretos.'
      });
    }

    const usuario = usuarios[0];

    if (!usuario.status) {
      return res.status(403).json({
        message: 'Esta conta está inativa.'
      });
    }

    const senhaValida = await verifyPassword(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({
        message: 'E-mail ou senha incorretos.'
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        console.error('Erro ao criar sessão:', error.message);
        return res.status(500).json({
          message: 'Não foi possível iniciar a sessão.'
        });
      }

      req.session.usuario = {
        id: usuario.id,
        email: usuario.email,
        tipoUsuario: usuario.tipo_usuario
      };

      req.session.save((saveError) => {
        if (saveError) {
          console.error('Erro ao salvar sessão:', saveError.message);
          return res.status(500).json({
            message: 'Não foi possível iniciar a sessão.'
          });
        }

        return res.status(200).json({
          data: {
            usuario: req.session.usuario
          }
        });
      });
    });

  } catch (error) {
    console.error('Erro no login:', error.message);

    return res.status(500).json({
      message: 'Não foi possível realizar o login.'
    });
  }
});

// Consultar sessão atual
app.get('/api/v1/auth/me', (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({
      message: 'Usuário não autenticado.'
    });
  }

  return res.status(200).json({
    data: {
      usuario: req.session.usuario
    }
  });
});

// Logout
app.post('/api/v1/auth/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Erro ao encerrar sessão:', error.message);
      return res.status(500).json({
        message: 'Não foi possível encerrar a sessão.'
      });
    }

    res.clearCookie('biocargo.sid');

    return res.status(200).json({
      message: 'Logout realizado com sucesso.'
    });
  });
});

// Verificação da API e conexão com MySQL
app.get('/api/v1/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.status(200).json({
      status: 'OK',
      message: 'API BioCargo funcionando!',
      database: 'Conectado'
    });
  } catch (error) {
    console.error('Erro na conexão com MySQL:', error.message);

    res.status(500).json({
      status: 'ERROR',
      message: 'API funcionando, mas sem conexão com o banco.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`BioCargo API rodando em http://localhost:${PORT}`);
});
