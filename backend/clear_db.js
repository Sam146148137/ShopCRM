const pool = require('./db');

async function clearDB() {
  try {
    await pool.query('TRUNCATE TABLE sales RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE products RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE customers RESTART IDENTITY CASCADE');
    console.log('Database cleared!');
  } catch (err) {
    console.error('Error clearing database:', err);
  } finally {
    await pool.end();
  }
}

clearDB(); 