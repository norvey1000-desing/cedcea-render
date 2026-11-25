const pool = require('../config/db');

const crearTablaAsignaturas = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS asignaturas (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(50) UNIQUE NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      plan_estudio TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Asegura que la columna exista si la tabla ya fue creada previamente
    ALTER TABLE asignaturas ADD COLUMN IF NOT EXISTS plan_estudio TEXT;

    CREATE TABLE IF NOT EXISTS docente_asignaturas (
      id SERIAL PRIMARY KEY,
      docente_id INT REFERENCES docentes(id) ON DELETE CASCADE,
      asignatura_id INT REFERENCES asignaturas(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_docente FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE CASCADE,
      CONSTRAINT fk_asignatura FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id) ON DELETE CASCADE
    );
  `;

  try {
    await pool.query(query);
    console.log('Tabla "asignaturas" y columnas verificadas con éxito.');
  } catch (error) {
    console.error('Error al inicializar la tabla de asignaturas:', error);
  }
};

module.exports = { crearTablaAsignaturas };