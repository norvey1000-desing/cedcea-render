const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Ajusta la ruta de tu conexión a la BD

// ==========================================
// CREACIÓN AUTOMÁTICA DE TABLAS AL INICIAR LA RUTA
// ==========================================
const crearTablaAreasAutomatica = async () => {
  try {
    // 1. Crear la tabla de áreas si no existe
    const queryAreas = `
      CREATE TABLE IF NOT EXISTS areas (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50),
        nombre VARCHAR(150) NOT NULL,
        descripcion TEXT
      );
    `;
    await pool.query(queryAreas);

    // 2. Asegurar que la tabla asignaturas tenga la columna area_id y su llave foránea
    const queryAsignaturasAlter = `
      ALTER TABLE asignaturas 
      ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL;
    `;
    await pool.query(queryAsignaturasAlter);

    console.log('✅ Estructura de tablas "areas" y "area_id" verificada/creada automáticamente.');
  } catch (err) {
    console.error('❌ Error al crear las tablas automáticamente:', err);
  }
};

// Ejecutamos la función al cargar el archivo de rutas
crearTablaAreasAutomatica();

// ==========================================
// RUTAS PARA ÁREAS ACADÉMICAS
// ==========================================

// GET: Obtener todas las áreas
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM areas ORDER BY id ASC;');
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener áreas:', err);
    return res.status(500).json({ error: 'Error al obtener las áreas' });
  }
});

// POST: Crear un área nueva
router.post('/', async (req, res) => {
  try {
    const { codigo, nombre, descripcion } = req.body;
    const query = `
      INSERT INTO areas (codigo, nombre, descripcion)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await pool.query(query, [codigo, nombre, descripcion]);
    return res.status(201).json({ mensaje: 'Área creada con éxito', area: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El código del área ya se encuentra registrado.' });
    }
    console.error('Error al crear área:', err);
    return res.status(500).json({ error: 'Error al crear el área' });
  }
});

module.exports = router;