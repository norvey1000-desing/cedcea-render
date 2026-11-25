const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Función para asegurar la tabla incluyendo la columna docente_id
const asegurarTablaSalones = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS salones (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(50) NOT NULL UNIQUE,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      docente_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  try {
    await pool.query(query);
    console.log('Tabla "salones" verificada o creada automáticamente con éxito.');
  } catch (error) {
    console.error('Error al crear la tabla salones:', error);
  }
};

// OBTENER ESTUDIANTES DE UN SALÓN ESPECÍFICO (GET /api/salones/:id/estudiantes)
router.get('/:id/estudiantes', async (req, res) => {
  const { id } = req.params;
  try {
  const query = `
  SELECT e.* 
  FROM estudiantes e
  WHERE e.salon_id = $1 
  AND (e.estado IS NULL OR e.estado != 'Inactivo')
  ORDER BY e.nombres_apellidos ASC
`;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener estudiantes del salón:', error);
    res.status(500).json({ error: 'Error al obtener los estudiantes del salón' });
  }
});

// 1. OBTENER TODOS LOS SALONES CON SU DIRECTOR (Cruce seguro en JavaScript)
router.get('/', async (req, res) => {
  try {
    // 1. Obtenemos todos los salones
    const salonesResult = await pool.query('SELECT * FROM salones ORDER BY id ASC');
    const salones = salonesResult.rows || [];

    // 2. Intentamos obtener todos los docentes de forma independiente
    let docentes = [];
    try {
      const docentesResult = await pool.query('SELECT * FROM docentes');
      docentes = docentesResult.rows || [];
    } catch (errDoc) {
      console.warn('Aviso: No se pudo consultar la tabla docentes:', errDoc.message);
    }

    // 3. Cruzamos la información de manera segura en JavaScript
    const salonesConDocente = salones.map(salon => {
      const docente = docentes.find(d => Number(d.id) === Number(salon.docente_id));
      
      let nombreDocente = null;
      if (docente) {
        nombreDocente = docente.nombres_apellidos || 
                        docente.nombre_completo || 
                        docente.nombre || 
                        docente.nombres || 
                        null;
      }

      return {
        ...salon,
        docente_nombre: nombreDocente
      };
    });

    res.json(salonesConDocente);
  } catch (error) {
    console.error('Error crítico al obtener salones:', error);
    res.status(500).json({ error: 'Error al obtener los salones' });
  }
});

// POST: Aplicar logro masivo a los boletines de los estudiantes del salón
router.post('/:id/logro-masivo', async (req, res) => {
  try {
    const salonId = req.params.id;
    const { periodo, logro } = req.body;

    if (!logro || !logro.trim()) {
      return res.status(400).json({ error: 'El texto del logro es obligatorio.' });
    }

    const periodoNum = periodo ? parseInt(periodo, 10) : 1;

    // 1. Obtenemos los estudiantes directamente del salón usando la tabla 'estudiantes'
    const queryEstudiantes = `
      SELECT id AS estudiante_id 
      FROM estudiantes 
      WHERE salon_id = $1;
    `;
    const resultadoEstudiantes = await pool.query(queryEstudiantes, [salonId]);
    const estudiantes = resultadoEstudiantes.rows;

    if (estudiantes.length === 0) {
      return res.status(404).json({ error: 'No se encontraron estudiantes asignados a este salón.' });
    }

    // 2. Iteramos sobre cada estudiante para inyectar o actualizar el logro en su boletín
    for (const est of estudiantes) {
      const estudianteId = est.estudiante_id;

      // Verificamos si ya existe un registro de boletín para este estudiante y período
      const queryVerificar = `
        SELECT id FROM boletines 
        WHERE estudiante_id = $1 AND periodo = $2;
      `;
      const boletinExistente = await pool.query(queryVerificar, [estudianteId, periodoNum]);

      if (boletinExistente.rows.length > 0) {
        // Actualizamos el logro existente
        const queryActualizar = `
          UPDATE boletines 
          SET estado = $1 
          WHERE estudiante_id = $2 AND periodo = $3;
        `;
        // Nota: Si en tu tabla boletines tienes la columna 'logro', reemplaza 'estado' por 'logro'
        await pool.query(queryActualizar, [logro, estudianteId, periodoNum]);
      } else {
        // Insertamos un nuevo registro de boletín con el logro
        const queryInsertar = `
          INSERT INTO boletines (estudiante_id, periodo, anio, estado) 
          VALUES ($1, $2, $3, $4);
        `;
        await pool.query(queryInsertar, [estudianteId, periodoNum, 2027, logro]);
      }
    }

    return res.json({ 
      mensaje: `¡Logro aplicado con éxito a los boletines de ${estudiantes.length} estudiantes!` 
    });

  } catch (err) {
    console.error('Error detallado en logro-masivo:', err);
    return res.status(500).json({ error: 'Error interno al procesar el logro masivo: ' + err.message });
  }
});

// 2. CREAR UN NUEVO SALÓN (POST /api/salones)
router.post('/', async (req, res) => {
  const { codigo, nombre, descripcion, docente_id } = req.body;
  try {
    const query = `
      INSERT INTO salones (codigo, nombre, descripcion, docente_id) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *;
    `;
    const valDocente = docente_id ? Number(docente_id) : null;
    const values = [codigo, nombre, descripcion, valDocente];
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      salon: result.rows[0],
      message: 'Salón creado exitosamente'
    });
  } catch (error) {
    console.error('Error detallado al crear salón:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. ACTUALIZAR UN SALÓN (PUT /api/salones/:id)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  
  if (!id || id === 'null' || isNaN(Number(id))) {
    return res.status(400).json({ error: 'ID de salón inválido o nulo' });
  }

  const { codigo, nombre, descripcion, docente_id } = req.body;
  try {
    const query = `
      UPDATE salones 
      SET codigo = $1, nombre = $2, descripcion = $3, docente_id = $4 
      WHERE id = $5 
      RETURNING *;
    `;
    const valDocente = (docente_id && docente_id !== 'null') ? Number(docente_id) : null;
    const values = [codigo, nombre, descripcion, valDocente, Number(id)];
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Salón não encontrado' });
    }

    res.json({
      success: true,
      salon: result.rows[0],
      message: 'Salón actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar salón:', error);
    res.status(500).json({ error: error.message });
  }
});


// ELIMINAR UN SALÓN (DELETE /api/salones/:id)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM salones WHERE id = $1 RETURNING *;', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Salón no encontrado' });
    }
    res.json({ success: true, message: 'Salón eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar salón:', error);
    res.status(500).json({ error: 'Error interno al eliminar el salón' });
  }
});

module.exports = router;
asegurarTablaSalones();