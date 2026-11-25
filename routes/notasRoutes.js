const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// POST: Registrar o actualizar nota de un estudiante
router.post('/', async (req, res) => {
  const { estudiante_id, salon_id, asignatura_id, docente_id, periodo, nota } = req.body;
  try {
    const query = `
      INSERT INTO notas (estudiante_id, salon_id, asignatura_id, docente_id, periodo, nota)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (estudiante_id, salon_id, asignatura_id, periodo)
      DO UPDATE SET nota = EXCLUDED.nota, docente_id = EXCLUDED.docente_id, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [estudiante_id, salon_id, asignatura_id, docente_id, periodo, nota];
    const result = await pool.query(query, values);
    res.json({ success: true, nota: result.rows[0] });
  } catch (error) {
    console.error('Error al guardar nota:', error);
    res.status(500).json({ error: 'Error al guardar la nota' });
  }
});

// GET: Obtener notas de un estudiante específico (para el Boletín)
router.get('/estudiante/:estudianteId', async (req, res) => {
  const { estudianteId } = req.params;
  try {
    const query = `
      SELECT n.*, a.nombre as asignatura_nombre, a.codigo as asignatura_codigo
      FROM notas n
      JOIN asignaturas a ON n.asignatura_id = a.id
      WHERE n.estudiante_id = $1;
    `;
    const result = await pool.query(query, [estudianteId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener notas para el boletín:', error);
    res.status(500).json({ error: 'Error al obtener las notas' });
  }
});

module.exports = router;