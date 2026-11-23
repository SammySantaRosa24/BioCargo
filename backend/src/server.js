import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import cors from 'cors';
import pool from './config/database.js';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import { requireAuthenticatedUser } from './middleware/authorization.js';
import { createProfileRouter } from './routes/profileRoutes.js';
import { createVehicleRouter } from './routes/vehicleRoutes.js';
import { createQualificationRouter } from './routes/qualificationRoutes.js';
import { createSearchRouter } from './routes/searchRoutes.js';
import { createInterestRouter, startInterestExpiryWorker } from './routes/interestRoutes.js';
import { createAdminRouter } from './routes/adminRoutes.js';
import { createDemandRouter } from './routes/demandRoutes.js';
import { createDeliveryRouter } from './routes/deliveryRoutes.js';
import { createDriverPhotoRouter } from './routes/driverPhotoRoutes.js';
import { isValidCnpj, normalizeCnpj } from './utils/brazilianDocuments.js';
import { hashPassword, verifyPassword } from './utils/passwords.js';
import { isCnpjAvailable } from './utils/registrationValidation.js';
import { inspectPrivateImage, optionalMultipartRaw, parseMultipartBody, removePrivateFile, storePrivateImage } from './utils/privateImages.js';

const app = express();
const PORT = process.env.PORT || 3000;
const driverPhotoStorageDir = path.resolve(process.env.DRIVER_PHOTO_STORAGE_DIR || './storage/private/driver-photos');
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'SUBSTITUA_POR_UM_SEGREDO_ALEATORIO_LOCAL') {
  throw new Error('SESSION_SECRET must be configured before starting the API.');
}
const MySQLStore = MySQLStoreFactory(session);
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
const configuredCorsOrigins = new Set(
  (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
);

app.use(express.json());
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredCorsOrigins.has(origin)) return callback(null, origin || false);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

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
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24
  }
}));

app.use('/api/v1', createProfileRouter(pool));
app.use('/api/v1', createVehicleRouter(pool));
app.use('/api/v1', createQualificationRouter(pool));
app.use('/api/v1', createSearchRouter(pool));
app.use('/api/v1', createInterestRouter(pool));
app.use('/api/v1', createDemandRouter(pool));
app.use('/api/v1', createDeliveryRouter(pool));
app.use('/api/v1', createDriverPhotoRouter(pool));
app.use('/api/v1', createAdminRouter(pool));
startInterestExpiryWorker(pool);

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
  const cnpjNormalizado = normalizeCnpj(cnpj);
  if (!isValidCnpj(cnpjNormalizado)) {
    return res.status(422).json({ message: 'O CNPJ deve conter 14 números com dígitos verificadores válidos.' });
  }

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

    if (!(await isCnpjAvailable(connection, cnpjNormalizado))) {
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
app.post('/api/v1/auth/register/driver', optionalMultipartRaw('7mb'), async (req, res) => {
  let requestBody = req.body;
  let profilePhoto = null;
  if (Buffer.isBuffer(requestBody)) {
    const parsed = parseMultipartBody(requestBody, req.headers['content-type'] || '');
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    requestBody = parsed.fields;
    profilePhoto = requestBody.fotoPerfil || null;
  }
  if (requestBody?.veiculos && typeof requestBody.veiculos === 'string') {
    try { requestBody.veiculos = JSON.parse(requestBody.veiculos); }
    catch { return res.status(400).json({ message: 'A lista de veículos deve ser um JSON válido.' }); }
  }
  const allowedFields = new Set(['nomeCompleto', 'cpf', 'cnpj', 'telefone', 'email', 'senha', 'veiculos', 'fotoPerfil']);
  if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody) ||
      Object.keys(requestBody).some((key) => !allowedFields.has(key))) {
    return res.status(400).json({ message: 'O cadastro contém campos não permitidos.' });
  }
  const {
    nomeCompleto,
    cpf,
    cnpj,
    telefone,
    email,
    senha,
    veiculos = []
  } = requestBody;

  const profileImage = profilePhoto ? inspectPrivateImage(profilePhoto) : null;
  if (profilePhoto && !profileImage) return res.status(422).json({ message: 'A foto deve ser uma imagem JPG ou PNG válida de até 5 MB.', errors: { fotoPerfil: 'Selecione uma imagem válida.' } });

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

  if (!Array.isArray(veiculos) || veiculos.some((veiculo) => (
    !veiculo ||
    typeof veiculo.placa !== 'string' || !veiculo.placa.trim() || veiculo.placa.trim().length > 8 ||
    typeof veiculo.renavam !== 'string' || !veiculo.renavam.trim() || veiculo.renavam.trim().length > 11 ||
    typeof veiculo.marca !== 'string' || !veiculo.marca.trim() || veiculo.marca.trim().length > 100 ||
    typeof veiculo.modelo !== 'string' || !veiculo.modelo.trim() || veiculo.modelo.trim().length > 100 ||
    (veiculo.descricao != null && (typeof veiculo.descricao !== 'string' || veiculo.descricao.length > 1000)) ||
    !Number.isInteger(veiculo.ano) || veiculo.ano < 1900 || veiculo.ano > new Date().getFullYear() + 1
  ))) {
    return res.status(400).json({ message: 'Confira os dados dos veículos informados.' });
  }

  const emailNormalizado = email.trim().toLowerCase();
  const cpfNormalizado = cpf.trim();
  const cnpjNormalizado = normalizeCnpj(cnpj);
  if (!isValidCnpj(cnpjNormalizado)) {
    return res.status(422).json({ message: 'O CNPJ deve conter 14 números com dígitos verificadores válidos.' });
  }

  let connection;
  let storedPhoto;

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

    const [cpfs] = await connection.execute('SELECT id FROM motorista WHERE cpf = ? LIMIT 1', [cpfNormalizado]);
    if (cpfs.length > 0 || !(await isCnpjAvailable(connection, cnpjNormalizado))) {
      await connection.rollback();
      return res.status(409).json({
        message: 'CPF ou CNPJ já cadastrado.'
      });
    }

    if (profilePhoto) storedPhoto = await storePrivateImage(profilePhoto, driverPhotoStorageDir, profileImage);

    const senhaHash = await hashPassword(senha);

    const [usuarioResult] = await connection.execute(
      `INSERT INTO usuario (email, senha, tipo_usuario)
       VALUES (?, ?, 'MOTORISTA')`,
      [emailNormalizado, senhaHash]
    );

    const [motoristaResult] = await connection.execute(
      `INSERT INTO motorista (
        usuario_id, nome, cpf, cnpj, telefone, foto_perfil_arquivo
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        usuarioResult.insertId,
        nomeCompleto.trim(),
        cpfNormalizado,
        cnpjNormalizado,
        telefone?.trim() || null,
        storedPhoto?.filename || null
      ]
    );

    for (const veiculo of veiculos) {
      await connection.execute(
        `INSERT INTO veiculo (motorista_id, placa, renavam, marca, modelo, descricao, ano)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [motoristaResult.insertId, veiculo.placa.trim(), veiculo.renavam.trim(),
          veiculo.marca.trim(), veiculo.modelo.trim(), veiculo.descricao?.trim() || null, veiculo.ano]
      );
    }

    await connection.commit();

    return res.status(201).json({
      data: {
        usuario: {
          id: usuarioResult.insertId,
          tipoUsuario: 'MOTORISTA'
        },
        motorista: {
          id: motoristaResult.insertId,
          fotoDisponivel: Boolean(storedPhoto)
        }
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    if (storedPhoto) await removePrivateFile(storedPhoto.path).catch(() => {});

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'E-mail, CPF, CNPJ, placa ou RENAVAM já cadastrado.'
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
app.get('/api/v1/auth/me', requireAuthenticatedUser(pool), (req, res) => {
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

app.use('/api/v1', (req, res) => {
  return res.status(404).json({ message: 'Rota da API não encontrada.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Corpo JSON inválido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Corpo da requisição excede o limite permitido.' });
  }
  console.error('Erro inesperado ao processar requisição da API.');
  return res.status(500).json({ message: 'Não foi possível processar a requisição.' });
});

app.listen(PORT, () => {
  console.log(`BioCargo API rodando em http://localhost:${PORT}`);
});
