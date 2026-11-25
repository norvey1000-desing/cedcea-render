const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Ajusta la ruta de tu conexión a la BD

// ==========================================
// CREACIÓN AUTOMÁTICA DE LA TABLA ASIGNATURAS AL INICIAR
// ==========================================
const crearTablaAsignaturasAutomatica = async () => {
  try {
    const queryAsignaturas = `
      CREATE TABLE IF NOT EXISTS asignaturas (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE,
        nombre VARCHAR(150) NOT NULL,
        plan_estudio TEXT,
        area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL
      );
    `;
    await pool.query(queryAsignaturas);
    console.log('✅ Estructura de la tabla "asignaturas" verificada/creada automáticamente.');
  } catch (err) {
    console.error('❌ Error al crear la tabla asignaturas automáticamente:', err);
  }
};

// Ejecutamos la función al cargar el archivo de rutas
crearTablaAsignaturasAutomatica();

// ==========================================
// RUTAS PARA ASIGNATURAS (Con soporte de Áreas)
// ==========================================

// GET: Obtener todas las asignaturas con el nombre de su área respectiva
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        a.*, 
        ar.nombre AS area_nombre 
      FROM asignaturas a
      LEFT JOIN areas ar ON a.area_id = ar.id
      ORDER BY a.id DESC;
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener asignaturas:', err);
    return res.status(500).json({ error: 'Error al obtener las asignaturas' });
  }
});

// POST: Crear una asignatura vinculada a un área
router.post('/', async (req, res) => {
  try {
    const { codigo, nombre, plan_estudio, area_id } = req.body;
    const query = `
      INSERT INTO asignaturas (codigo, nombre, plan_estudio, area_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query(query, [codigo, nombre, plan_estudio, area_id || null]);
    return res.status(201).json({ mensaje: 'Asignatura creada con éxito', asignatura: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El código de la asignatura ya se encuentra registrado.' });
    }
    console.error('Error al crear asignatura:', err);
    return res.status(500).json({ error: 'Error al crear la asignatura' });
  }
});

// PUT: Actualizar una asignatura y su área asociada
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, plan_estudio, area_id } = req.body;
    
    const query = `
      UPDATE asignaturas 
      SET codigo = $1, nombre = $2, plan_estudio = $3, area_id = $4 
      WHERE id = $5 
      RETURNING *;
    `;
    const result = await pool.query(query, [codigo, nombre, plan_estudio, area_id || null, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asignatura no encontrada' });
    }

    return res.json({ mensaje: 'Asignatura actualizada con éxito', asignatura: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El código de la asignatura ya está en uso por otra materia.' });
    }
    console.error('Error al actualizar asignatura:', err);
    return res.status(500).json({ error: 'Error al actualizar la asignatura' });
  }
});

// DELETE: Eliminar una asignatura
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM asignaturas WHERE id = $1;', [id]);
    return res.json({ mensaje: 'Asignatura eliminada con éxito' });
  } catch (err) {
    console.error('Error al eliminar asignatura:', err);
    return res.status(500).json({ error: 'Error al eliminar la asignatura' });
  }
});

module.exports = router;