export async function isCnpjAvailable(connection, normalizedCnpj) {
  const [rows] = await connection.execute(
    `SELECT id FROM empresa WHERE cnpj = ?
     UNION ALL
     SELECT id FROM motorista WHERE cnpj = ?
     LIMIT 1`,
    [normalizedCnpj, normalizedCnpj]
  );
  return rows.length === 0;
}
