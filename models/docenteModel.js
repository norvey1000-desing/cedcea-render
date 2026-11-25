const pool = require('../config/db');

// Función para crear la tabla de docentes en PostgreSQL si no existe
const crearTablaDocentes = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS docentes (
      id SERIAL PRIMARY KEY,
      identificacion VARCHAR(50) UNIQUE NOT NULL,
      nombre_completo VARCHAR(150) NOT NULL,
      especialidad VARCHAR(100),
      correo VARCHAR(100),
      telefono VARCHAR(30),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
  `;

  
  try {
    await pool.query(query);
    console.log('Tabla "docentes" verificada/creada con éxito en PostgreSQL.');
  } catch (error) {
    console.error('Error al crear la tabla de docentes:', error);
  }
};

module.exports = { crearTablaDocentes };