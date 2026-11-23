import 'dotenv/config';

if (!['development', 'test'].includes(process.env.NODE_ENV)) {
  console.error('Seed recusado: ADMIN de teste so pode ser criado com NODE_ENV=development ou NODE_ENV=test.');
  process.exitCode = 1;
} else {
  const [{ default: pool }, { seedTestAdmin }] = await Promise.all([
    import('../src/config/database.js'),
    import('../src/seeds/testAdmin.js'),
  ]);

  try {
    const result = await seedTestAdmin(pool, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    console.log(`${result.email}: ${result.result}`);
  } catch (error) {
    console.error(`Falha ao criar ADMIN de teste: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
