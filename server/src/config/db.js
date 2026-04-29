import mysql from 'mysql2/promise';

let pool;

export function getPool() {
  if (!pool) {
    const useSSL = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
    
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
      ssl: useSSL ? {
        rejectUnauthorized: false // Required for some cloud providers like Aiven/DigitalOcean
      } : undefined
    });
  }
  return pool;
}

export async function testConnection(retries = 2, delay = 1000) {
  const p = getPool();
  console.log(`Checking database connection (Host: ${process.env.DB_HOST || 'localhost'})...`);
  
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await p.getConnection();
      conn.release();
      console.log('✅ Database connection established successfully.');
      return true;
    } catch (err) {
      console.error(`❌ Database connection attempt ${i + 1} failed: ${err.message}`);
      
      if (err.code === 'ECONNREFUSED' && (process.env.DB_HOST === 'localhost' || !process.env.DB_HOST)) {
        console.error('HINT: Your backend is trying to connect to localhost. If this is Vercel, you MUST set DB_HOST to your remote database URL in the dashboard.');
      }
      
      if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('HINT: Access denied. Check your DB_USER and DB_PASSWORD environment variables.');
      }

      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000}s...`);
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

