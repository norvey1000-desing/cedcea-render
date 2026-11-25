const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const rawUrl = process.env.DATABASE_URL ? String(process.env.DATABASE_URL).trim() : '';

// Limpiamos channel_binding si viene en la URL para evitar conflictos con el driver pg
const connectionString = rawUrl.replace(/([&?])channel_binding=[^&]+(&|$)/, (match, sep, end) =>
  end === '&' ? sep : ''
);

if (!connectionString) {
  console.error('❌ ERROR: Falta DATABASE_URL en las variables de entorno o en backend/.env');
}

const isLocalhost =
  connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocalhost
    ? false
    : {
        rejectUnauthorized: false,
      },
});

pool.on('connect', () => {
  console.log('✅ Base de datos PostgreSQL conectada exitosamente');
});

pool.on('error', (err) => {
  console.error('❌ Error en el pool de PostgreSQL:', err.message);
});

module.exports = pool;