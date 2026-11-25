const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Función para verificar y crear las tablas de docentes y sus asignaturas automáticamente
const crearTablasDocentesAutomatica = async () => {
  const queryDocentes = `
    CREATE TABLE IF NOT EXISTS docentes (
      id SERIAL PRIMARY KEY,
      identificacion VARCHAR(50) UNIQUE NOT NULL,
      nombre_completo VARCHAR(150) NOT NULL,
      especialidad VARCHAR(100),
      correo VARCHAR(100),
      telefono VARCHAR(30),
      sexo VARCHAR(20),
      direccion TEXT,
      fecha_nacimiento DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const queryIntermedia = `
    CREATE TABLE IF NOT EXISTS docente_asignaturas (
      id SERIAL PRIMARY KEY,
      docente_id INTEGER REFERENCES docentes(id) ON DELETE CASCADE,
      asignatura_id INTEGER REFERENCES asignaturas(id) ON DELETE CASCADE,
      UNIQUE (docente_id, asignatura_id)
    );
  `;

  try {
    await pool.query(queryDocentes);
    // Asegurar columnas si la tabla ya existía previamente
    await pool.query(`ALTER TABLE docentes ADD COLUMN IF NOT EXISTS sexo VARCHAR(20);`);
    await pool.query(`ALTER TABLE docentes ADD COLUMN IF NOT EXISTS direccion TEXT;`);
    await pool.query(`ALTER TABLE docentes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;`);
    
    await pool.query(queryIntermedia);
    
    console.log('✅ Tablas "docentes" y "docente_asignaturas" verificadas/creadas con éxito en PostgreSQL.');
  } catch (error) {
    console.error('❌ Error al crear las tablas de docentes:', error);
  }
};

crearTablasDocentesAutomatica();

// GET: Obtener todos los docentes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM docentes ORDER BY id DESC;');
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener docentes:', err);
    return res.status(500).json({ error: 'Error al obtener los docentes' });
  }
});

// POST: Registrar un nuevo docente
router.post('/', async (req, res) => {
  try {
    console.log("Datos recibidos:", req.body);
    const { identificacion, nombreCompleto, especialidad, correo, telefono, sexo, direccion, fecha_nacimiento } = req.body;
    
    const query = `
      INSERT INTO docentes (identificacion, nombre_completo, especialidad, correo, telefono, sexo, direccion, fecha_nacimiento)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [identificacion, nombreCompleto, especialidad, correo, telefono, sexo, direccion, fecha_nacimiento || null];
    const newDocente = await pool.query(query, values);
    
    return res.status(201).json({ 
      mensaje: 'Docente registrado con éxito', 
      docente: newDocente.rows[0] 
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un docente registrado con esta identificación.' });
    }
    console.error('Error en el servidor:', err);
    return res.status(500).json({ error: 'Error al registrar el docente' });
  }
});

// PUT: Actualizar un docente existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { identificacion, nombreCompleto, especialidad, correo, telefono, sexo, direccion, fecha_nacimiento } = req.body;

    const query = `
      UPDATE docentes 
      SET identificacion = $1, nombre_completo = $2, especialidad = $3, correo = $4, telefono = $5, sexo = $6, direccion = $7, fecha_nacimiento = $8
      WHERE id = $9
      RETURNING *;
    `;
    const values = [identificacion, nombreCompleto, especialidad, correo, telefono, sexo, direccion, fecha_nacimiento || null, id];
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Docente no encontrado' });
    }

    return res.json({ mensaje: 'Docente actualizado con éxito', docente: result.rows[0] });
  } catch (err) {
    console.error('Error al actualizar el docente:', err);
    return res.status(500).json({ error: 'Error al actualizar el docente' });
  }
});

// DELETE: Eliminar un docente por ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM docentes WHERE id = $1 RETURNING *;';
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Docente no encontrado' });
    }

    return res.json({ mensaje: 'Docente eliminado con éxito', docente: result.rows[0] });
  } catch (err) {
    console.error('Error al eliminar el docente:', err);
    return res.status(500).json({ error: 'Error al eliminar el docente' });
  }
});

// GET: Obtener las asignaturas asignadas a un docente específico
router.get('/:id/asignaturas', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT a.id, a.codigo, a.nombre, a.plan_estudio 
      FROM asignaturas a
      JOIN docente_asignaturas da ON a.id = da.asignatura_id
      WHERE da.docente_id = $1;
    `;
    const result = await pool.query(query, [id]);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener asignaturas del docente:', err);
    return res.status(500).json({ error: 'Error al obtener asignaturas del docente' });
  }
});

// POST: Asignar una asignatura a un docente
router.post('/:id/asignaturas', async (req, res) => {
  try {
    const { id } = req.params;
    const { asignatura_id } = req.body;
    
    const query = `
      INSERT INTO docente_asignaturas (docente_id, asignatura_id)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const result = await pool.query(query, [id, asignatura_id]);
    return res.status(201).json({ mensaje: 'Asignatura asignada con éxito', relacion: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El docente ya tiene asignada esta materia.' });
    }
    console.error('Error al asignar asignatura:', err);
    return res.status(500).json({ error: 'Error al asignar la asignatura' });
  }
});

// DELETE: Quitar/Desvincular una asignatura de un docente
router.delete('/:docenteId/asignaturas/:asignaturaId', async (req, res) => {
  try {
    const { docenteId, asignaturaId } = req.params;
    const query = `
      DELETE FROM docente_asignaturas 
      WHERE docente_id = $1 AND asignatura_id = $2;
    `;
    await pool.query(query, [docenteId, asignaturaId]);
    return res.json({ mensaje: 'Asignatura desvinculada con éxito' });
  } catch (err) {
    console.error('Error al desvincular asignatura:', err);
    return res.status(500).json({ error: 'Error al desvincular la asignatura' });
  }
});

// Guardar logro general del salón por periodo
router.post('/guardar-logro-salon', async (req, res) => {
  const { grado, periodo, anio, logro_texto } = req.body;
  try {
    const query = `
      INSERT INTO logros_salones (grado, periodo, anio, logro_texto)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (grado, periodo, anio) 
      DO UPDATE SET logro_texto = EXCLUDED.logro_texto;
    `;
    await pool.query(query, [grado, periodo, anio, logro_texto]);
    return res.json({ success: true, message: 'Logro del salón actualizado' });
  } catch (error) {
    console.error('Error al guardar el logro:', error);
    return res.status(500).json({ error: 'Error al guardar el logro' });
  }
});

module.exports = router;