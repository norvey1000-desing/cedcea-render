const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Función segura para crear la tabla 'boletines' sin errores
const asegurarTablaBoletines = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS boletines (
          id SERIAL PRIMARY KEY,
          estudiante_id INT NOT NULL,
          periodo INT NOT NULL,
          anio INT NOT NULL,
          estado VARCHAR(50),
          archivo_pdf TEXT,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      ALTER TABLE boletines ADD COLUMN IF NOT EXISTS archivo_pdf TEXT;
    `);
  } catch (err) {
    console.error('Error al asegurar la tabla boletines:', err);
  }
};

// Ejecutar al iniciar
asegurarTablaBoletines();

// ==========================================
// 1. GET: Obtener datos dinámicos del boletín (con Director de Grupo, Áreas Reales y Logro)
// ==========================================
router.get('/estudiantes/:id/boletin', async (req, res) => {
  const estudianteId = req.params.id;

  try {
    const estIdNum = parseInt(estudianteId, 10);
    if (isNaN(estIdNum)) {
      return res.status(400).json({ error: 'ID de estudiante inválido.' });
    }

    // 1. Obtener datos básicos del estudiante
    const resEstudiante = await pool.query('SELECT * FROM estudiantes WHERE id = $1', [estIdNum]);
    if (resEstudiante.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado.' });
    }
    const estudiante = resEstudiante.rows[0];

    // 2. Determinar el salón del estudiante
    let salonId = estudiante.salon_id;

    if (!salonId) {
      try {
        const resMat = await pool.query('SELECT salon_id FROM matriculas WHERE estudiante_id = $1 LIMIT 1', [estIdNum]);
        if (resMat.rows.length > 0 && resMat.rows[0].salon_id) {
          salonId = resMat.rows[0].salon_id;
        }
      } catch (eMat) {
        console.warn('Aviso al buscar salon en matriculas:', eMat.message);
      }
    }

    if (!salonId && estudiante.grado) {
      try {
        const resSalGrado = await pool.query(
          `SELECT id FROM salones WHERE codigo = $1 OR nombre ILIKE $2 LIMIT 1`,
          [String(estudiante.grado), `%${estudiante.grado}%`]
        );
        if (resSalGrado.rows.length > 0) {
          salonId = resSalGrado.rows[0].id;
        }
      } catch (eSal) {
        console.warn('Aviso al buscar salon por grado:', eSal.message);
      }
    }

    // 3. Obtener el docente asignado a ese salón (Director de Grupo)
    let directorGrupo = 'Por Asignar';
    if (salonId) {
      try {
        const resSalon = await pool.query('SELECT * FROM salones WHERE id = $1', [salonId]);
        if (resSalon.rows.length > 0) {
          const salonRow = resSalon.rows[0];
          if (salonRow.docente_id) {
            const resDocente = await pool.query('SELECT * FROM docentes WHERE id = $1', [salonRow.docente_id]);
            if (resDocente.rows.length > 0) {
              const doc = resDocente.rows[0];
              directorGrupo = doc.nombres_apellidos || doc.nombre_completo || doc.nombre || doc.nombres || 'Por Asignar';
            }
          }
        }
      } catch (eDoc) {
        console.warn('Error al resolver director de grupo:', eDoc.message);
      }
    }

    estudiante.director_grupo = directorGrupo;

    // 4. Obtener calificaciones cruzando 'asignaturas' con 'areas'
    let resCalificaciones;
    try {
      const queryCalificacionesConArea = `
        SELECT 
          c.id AS calificacion_id,
          c.nota,
          c.desempeno,
          c.observacion,
          COALESCE(a.nombre, 'Sin Asignatura') AS asignatura_nombre,
          COALESCE(ar.nombre, 'ÁREA GENERAL') AS area_nombre
        FROM calificaciones c
        LEFT JOIN asignaturas a ON c.asignatura_id = a.id
        LEFT JOIN areas ar ON a.area_id = ar.id
        WHERE c.estudiante_id = $1;
      `;
      resCalificaciones = await pool.query(queryCalificacionesConArea, [estIdNum]);
    } catch (errCal) {
      console.warn('Aviso en consulta de áreas:', errCal.message);
      const queryCalificacionesBase = `
        SELECT 
          c.id AS calificacion_id,
          c.nota,
          c.desempeno,
          c.observacion,
          COALESCE(a.nombre, 'Sin Asignatura') AS asignatura_nombre,
          'ÁREA GENERAL' AS area_nombre
        FROM calificaciones c
        LEFT JOIN asignaturas a ON c.asignatura_id = a.id
        WHERE c.estudiante_id = $1;
      `;
      resCalificaciones = await pool.query(queryCalificacionesBase, [estIdNum]);
    }

    // 5. Obtener el Logro Masivo guardado en la columna 'estado' de la tabla 'boletines'
    let logroMasivo = '';
    try {
      const queryBoletin = `
        SELECT estado 
        FROM boletines 
        WHERE estudiante_id = $1 
        ORDER BY id DESC LIMIT 1;
      `;
      const resBoletin = await pool.query(queryBoletin, [estIdNum]);
      if (resBoletin.rows.length > 0) {
        logroMasivo = resBoletin.rows[0].estado || '';
      }
    } catch (errB) {
      console.warn('Aviso al consultar logro en boletines:', errB.message);
    }

    return res.status(200).json({
      estudiante,
      calificaciones: resCalificaciones.rows,
      logro: logroMasivo
    });

  } catch (error) {
    console.error('❌ ERROR SQL EN BOLETÍN DINÁMICO:', error.message);
    return res.status(500).json({ 
      error: 'Error en la base de datos al generar el boletín.',
      detalle: error.message 
    });
  }
});

// ==========================================
// 2. POST: Guardar boletín en el historial
// ==========================================
router.post('/', async (req, res) => {
  try {
    await asegurarTablaBoletines();
    let { estudiante_id, periodo, anio, estado, archivo_pdf } = req.body;
    
    const estIdNum = parseInt(estudiante_id, 10);
    const periodoNum = (periodo !== undefined && periodo !== null && periodo !== '' && !isNaN(periodo)) ? parseInt(periodo, 10) : 4;
    const anioNum = (anio !== undefined && anio !== null && anio !== '' && !isNaN(anio)) ? parseInt(anio, 10) : 2027;
    const estadoStr = estado || 'Guardado';
    const pdfStr = archivo_pdf || null;

    if (isNaN(estIdNum)) {
      return res.status(400).json({ error: 'El ID del estudiante es obligatorio y debe ser numérico.' });
    }

    const query = `
      INSERT INTO boletines (estudiante_id, periodo, anio, estado, archivo_pdf)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    
    const result = await pool.query(query, [estIdNum, periodoNum, anioNum, estadoStr, pdfStr]);
    return res.status(201).json({ mensaje: 'Boletín guardado con éxito', boletin: result.rows[0] });
  } catch (err) {
    console.error('Error al guardar boletín:', err);
    return res.status(500).json({ error: 'Error al guardar el boletín', detalle: err.message });
  }
});

// ==========================================
// 3. GET: Obtener los boletines de un estudiante específico para su historial
// ==========================================
router.get('/estudiante/:estudiante_id', async (req, res) => {
  try {
    await asegurarTablaBoletines();
    const { estudiante_id } = req.params;
    
    const estIdNum = parseInt(estudiante_id, 10);
    if (isNaN(estIdNum)) {
      return res.status(400).json({ error: 'ID de estudiante inválido' });
    }

    const result = await pool.query('SELECT * FROM boletines WHERE estudiante_id = $1 ORDER BY id DESC;', [estIdNum]);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener boletines:', err);
    return res.status(500).json({ error: 'Error al obtener los boletines', detalle: err.message });
  }
});

// ==========================================
// 4. RUTA UNIFICADA: Historial y Datos del Estudiante
// ==========================================
router.get('/estudiantes/:id/historial', async (req, res) => {
  try {
    const estudianteId = req.params.id;
    const estIdNum = parseInt(estudianteId, 10);
    
    if (isNaN(estIdNum)) {
      return res.status(400).json({ success: false, error: 'ID de estudiante inválido' });
    }
    
    const estudianteRes = await pool.query('SELECT * FROM estudiantes WHERE id = $1', [estIdNum]);
    
    if (estudianteRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Estudiante no encontrado' });
    }

    const boletinesRes = await pool.query('SELECT * FROM boletines WHERE estudiante_id = $1 ORDER BY id DESC;', [estIdNum]);

    return res.json({
      success: true,
      estudiante: estudianteRes.rows[0],
      boletines: boletinesRes.rows
    });
  } catch (error) {
    console.error('Error al cargar historial unificado:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. POST: Registrar nuevo estudiante
// ==========================================
router.post('/estudiantes', async (req, res) => {
  try {
    const {
      codigoCedsea, fechaMatricula, grado, anioIngreso, nombresApellidos,
      fechaNacimiento, lugarNacimiento, tipoDocumento, numeroDocumento,
      edad, sexo, nacionalidad, telefonoFamiliar, direccion, barrio,
      municipio, institucionAnterior, ultimoGrado, culminoGrado, estudioAntesCedsea
    } = req.body;

    const query = `
      INSERT INTO estudiantes (
        codigo_cedsea, fecha_matricula, grado, anio_ingreso, nombres_apellidos,
        fecha_nacimiento, lugar_nacimiento, tipo_documento, numero_documento,
        edad, sexo, nacionalidad, telefono_familiar, direccion, barrio,
        municipio, institucion_anterior, ultimo_grado, culmino_grado, estudio_antes_cedsea
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *;
    `;

    const values = [
      codigoCedsea, fechaMatricula, grado, anioIngreso, nombresApellidos,
      fechaNacimiento, lugarNacimiento, tipoDocumento, numeroDocumento,
      edad, sexo, nacionalidad, telefonoFamiliar, direccion, barrio,
      municipio, institucionAnterior, ultimoGrado, culminoGrado, estudioAntesCedsea
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({ 
      success: true, 
      message: 'Estudiante matriculado con éxito', 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Error al registrar estudiante:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 6. DELETE: Eliminar un boletín del historial
// ==========================================
router.delete('/:id', async (req, res) => {
  try {
    await asegurarTablaBoletines();
    const { id } = req.params;
    const idNum = parseInt(id, 10);

    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'ID de boletín inválido' });
    }

    const result = await pool.query('DELETE FROM boletines WHERE id = $1 RETURNING *;', [idNum]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Boletín no encontrado' });
    }
    return res.json({ mensaje: 'Boletín eliminado con éxito', boletin: result.rows[0] });
  } catch (err) {
    console.error('Error al eliminar boletín:', err);
    return res.status(500).json({ error: 'Error al eliminar el boletín', detalle: err.message });
  }
});

module.exports = router;