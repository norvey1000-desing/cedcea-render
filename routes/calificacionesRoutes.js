const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Mantiene la misma ruta de conexión que usas

// 1. Función para crear la tabla y asegurar las columnas de período y año automáticamente al iniciar
const crearTablaCalificaciones = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS calificaciones (
      id SERIAL PRIMARY KEY,
      salon_id INTEGER REFERENCES salones(id) ON DELETE CASCADE,
      asignatura_id INTEGER REFERENCES asignaturas(id) ON DELETE CASCADE,
      docente_id INTEGER REFERENCES docentes(id) ON DELETE CASCADE,
      estudiante_id INTEGER REFERENCES estudiantes(id) ON DELETE CASCADE,
      periodo INTEGER DEFAULT 1,
      anio INTEGER DEFAULT 2026,
      nota DECIMAL(3,2),
      desempeno VARCHAR(50),
      observacion TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    // Agrega las columnas si la tabla ya existía previamente sin ellas
    await pool.query(`ALTER TABLE calificaciones ADD COLUMN IF NOT EXISTS periodo INTEGER DEFAULT 1;`);
    await pool.query(`ALTER TABLE calificaciones ADD COLUMN IF NOT EXISTS anio INTEGER DEFAULT 2026;`);
    console.log('Tabla "calificaciones" verificada y actualizada con éxito en PostgreSQL (Soporte para Año y Período).');
  } catch (err) {
    console.error('Error al crear o actualizar la tabla calificaciones:', err);
  }
};

// Llama a la función al importar el archivo o al iniciar la app
crearTablaCalificaciones();

// 2. Endpoint para registrar o actualizar calificaciones en lote (filtrando por año y período)
router.post('/calificaciones', async (req, res) => {
  const { salon_id, asignatura_id, docente_id, periodo, anio, calificaciones } = req.body;

  // Validamos que vengan el período y el año (si no, asumimos 1 y el año actual respectivamente)
  const periodoActual = periodo || 1;
  const anioActual = anio || new Date().getFullYear();

  if (!salon_id || !asignatura_id || !docente_id || !Array.isArray(calificaciones)) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para procesar las calificaciones.' });
  }

  try {
    for (const item of calificaciones) {
      // Verificamos si ya existe una calificación para este estudiante, materia, salón, PERÍODO y AÑO
      const queryCheck = `
        SELECT id FROM calificaciones 
        WHERE salon_id = $1 AND asignatura_id = $2 AND estudiante_id = $3 AND periodo = $4 AND anio = $5
      `;
      const resultCheck = await pool.query(queryCheck, [salon_id, asignatura_id, item.estudiante_id, periodoActual, anioActual]);

      if (resultCheck.rows.length > 0) {
        // Si ya existe en ese período y año, actualizamos los datos
        const queryUpdate = `
          UPDATE calificaciones 
          SET nota = $1, desempeno = $2, observacion = $3, docente_id = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `;
        await pool.query(queryUpdate, [
          item.nota, 
          item.desempeno, 
          item.observacion, 
          docente_id, 
          resultCheck.rows[0].id
        ]);
      } else {
        // Si no existe para ese período y año, insertamos un registro nuevo
        const queryInsert = `
          INSERT INTO calificaciones (salon_id, asignatura_id, docente_id, estudiante_id, periodo, anio, nota, desempeno, observacion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await pool.query(queryInsert, [
          salon_id, 
          asignatura_id, 
          docente_id, 
          item.estudiante_id, 
          periodoActual,
          anioActual,
          item.nota, 
          item.desempeno, 
          item.observacion
        ]);
      }
    }

    res.status(200).json({ mensaje: `Calificaciones guardadas exitosamente para el Período ${periodoActual} del Año ${anioActual}.` });
  } catch (error) {
    console.error('Error al guardar el lote de calificaciones:', error);
    res.status(500).json({ error: 'Error interno al procesar las calificaciones en el servidor.' });
  }
});

// 3. Endpoint para obtener el historial de calificaciones de un estudiante
router.get('/estudiantes/:id/calificaciones', async (req, res) => {
  try {
    const estudianteId = req.params.id;
    const query = `
      SELECT 
        c.id,
        c.periodo,
        c.anio,
        c.nota,
        c.desempeno,
        c.observacion,
        COALESCE(a.nombre, 'Asignatura no asignada') AS asignatura_nombre,
        COALESCE(ar.nombre, 'Sin área') AS area_nombre
      FROM calificaciones c
      LEFT JOIN asignaturas a ON c.asignatura_id = a.id
      LEFT JOIN areas ar ON a.area_id = ar.id
      WHERE c.estudiante_id = $1
      ORDER BY c.anio DESC, c.periodo ASC, ar.id ASC, a.id ASC;
    `;
    const resultado = await pool.query(query, [estudianteId]);
    return res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error detallado al obtener calificaciones del estudiante:', error);
    return res.status(500).json({ error: 'Error interno al consultar las notas.' });
  }
});

module.exports = router;