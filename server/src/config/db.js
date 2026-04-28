import mysql from 'mysql2/promise';

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'clic_campus',
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

export async function testConnection(retries = 5, delay = 5000) {
  const p = getPool();
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await p.getConnection();
      conn.release();
      return true;
    } catch (err) {
      console.warn(`Database connection attempt ${i + 1} failed: ${err.message}`);
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

export async function query(sql, params) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

