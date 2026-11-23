import 'dotenv/config';

if (!['development', 'test'].includes(process.env.NODE_ENV)) {
  console.error('Seed recusado: contas padrão só podem ser criadas com NODE_ENV=development ou NODE_ENV=test.');
  process.exitCode = 1;
} else {
  const [{ default: pool }, { seedTestUsers }] = await Promise.all([
    import('../src/config/database.js'),
    import('../src/seeds/testUsers.js'),
  ]);

  try {
    const results = await seedTestUsers(pool);
    for (const result of results) console.log(`${result.email}: ${result.result}`);
  } catch (error) {
    console.error(`Falha ao criar contas de teste: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
