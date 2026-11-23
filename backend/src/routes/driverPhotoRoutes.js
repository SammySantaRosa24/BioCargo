import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuthenticatedUser } from '../middleware/authorization.js';
import { inspectPrivateImage, optionalMultipartRaw, parseMultipartBody, removePrivateFile, storePrivateImage } from '../utils/privateImages.js';

const DEFAULT_STORAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage/private/driver-photos');
const SAFE_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png)$/i;

function sendPrivatePhoto(res, storageDir, filename) {
  if (!filename || !SAFE_FILE.test(filename)) return res.status(404).json({ message: 'Foto do motorista não encontrada.' });
  res.setHeader('Content-Type', filename.endsWith('.png') ? 'image/png' : 'image/jpeg');
  res.setHeader('Content-Disposition', 'inline; filename="foto-perfil"');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(path.join(storageDir, filename), (error) => {
    if (error && !res.headersSent) res.status(404).json({ message: 'Foto do motorista não encontrada.' });
  });
}

export function createDriverPhotoRouter(pool, { storageDir = process.env.DRIVER_PHOTO_STORAGE_DIR || DEFAULT_STORAGE } = {}) {
  const router = Router();
  const requireDriver = requireAuthenticatedUser(pool, ['MOTORISTA']);
  const requireViewer = requireAuthenticatedUser(pool, ['EMPRESA', 'MOTORISTA', 'ADMIN']);

  router.get('/drivers/me/photo', requireDriver, async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT foto_perfil_arquivo FROM motorista WHERE usuario_id = ? LIMIT 1', [req.authenticatedUser.id]);
      if (!rows[0]?.foto_perfil_arquivo) return res.status(404).json({ message: 'Foto do motorista não cadastrada.' });
      return sendPrivatePhoto(res, storageDir, rows[0].foto_perfil_arquivo);
    } catch { return res.status(500).json({ message: 'Não foi possível consultar a foto do motorista.' }); }
  });

  router.put('/drivers/me/photo', requireDriver, optionalMultipartRaw('6mb'), async (req, res) => {
    const parsed = parseMultipartBody(req.body, req.headers['content-type'] || '');
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const fields = parsed.fields;
    if (Object.keys(fields).length !== 1 || !Object.hasOwn(fields, 'fotoPerfil')) return res.status(400).json({ message: 'Envie somente o campo fotoPerfil.' });
    const image = inspectPrivateImage(fields.fotoPerfil);
    if (!image) return res.status(422).json({ message: 'A foto deve ser uma imagem JPG ou PNG válida de até 5 MB.', errors: { fotoPerfil: 'Selecione uma imagem válida.' } });

    let stored;
    let connection;
    try {
      stored = await storePrivateImage(fields.fotoPerfil, storageDir, image);
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [profiles] = await connection.execute('SELECT id, foto_perfil_arquivo AS fotoAnterior FROM motorista WHERE usuario_id = ? FOR UPDATE', [req.authenticatedUser.id]);
      if (!profiles[0]) { await connection.rollback(); await removePrivateFile(stored.path); return res.status(404).json({ message: 'Perfil de motorista não encontrado.' }); }
      await connection.execute('UPDATE motorista SET foto_perfil_arquivo = ? WHERE id = ?', [stored.filename, profiles[0].id]);
      await connection.commit();
      if (profiles[0].fotoAnterior && SAFE_FILE.test(profiles[0].fotoAnterior)) {
        await removePrivateFile(path.join(storageDir, profiles[0].fotoAnterior)).catch(() => {});
      }
      return res.status(200).json({ data: { fotoDisponivel: true, fotoUrl: '/api/v1/drivers/me/photo' } });
    } catch {
      if (connection) await connection.rollback();
      if (stored) await removePrivateFile(stored.path).catch(() => {});
      return res.status(500).json({ message: 'Não foi possível atualizar a foto do motorista.' });
    } finally { connection?.release(); }
  });

  router.get('/drivers/:id/photo', requireViewer, async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) return res.status(400).json({ message: 'ID de motorista inválido.' });
    const driverId = Number(req.params.id);
    try {
      const [drivers] = await pool.execute(
        `SELECT m.usuario_id AS usuarioId, m.disponivel, m.foto_perfil_arquivo AS foto
         FROM motorista m INNER JOIN usuario u ON u.id = m.usuario_id
         WHERE m.id = ? AND u.status = TRUE LIMIT 1`, [driverId]
      );
      const driver = drivers[0];
      if (!driver?.foto) return res.status(404).json({ message: 'Foto do motorista não encontrada.' });
      if (req.authenticatedUser.tipoUsuario === 'MOTORISTA' && Number(driver.usuarioId) !== Number(req.authenticatedUser.id)) {
        return res.status(404).json({ message: 'Foto do motorista não encontrada.' });
      }
      if (req.authenticatedUser.tipoUsuario === 'EMPRESA') {
        const [companies] = await pool.execute('SELECT id FROM empresa WHERE usuario_id = ? LIMIT 1', [req.authenticatedUser.id]);
        if (!companies[0]) return res.status(404).json({ message: 'Foto do motorista não encontrada.' });
        let hasProfileAccess = Boolean(driver.disponivel);
        if (!hasProfileAccess) {
          const [interests] = await pool.execute(
            'SELECT id FROM interesse WHERE empresa_id = ? AND motorista_id = ? LIMIT 1',
            [companies[0].id, driverId]
          );
          hasProfileAccess = interests.length > 0;
        }
        if (!hasProfileAccess) return res.status(404).json({ message: 'Foto do motorista não encontrada.' });
      }
      return sendPrivatePhoto(res, storageDir, driver.foto);
    } catch { return res.status(500).json({ message: 'Não foi possível consultar a foto do motorista.' }); }
  });

  return router;
}
