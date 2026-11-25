const express = require('express');
const estudiante = express.Router();
const pool = require('../config/db');

// Crear la tabla "estudiantes" automáticamente y asegurar todas sus columnas en PostgreSQL
const inicializarTablaEstudiantes = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS estudiantes (
        id SERIAL PRIMARY KEY,
        codigo_estudiante VARCHAR(100),
        codigo_cedsea VARCHAR(100),
        fecha_matricula VARCHAR(50),
        grado VARCHAR(50),
        anio_ingreso VARCHAR(10),
        nombres_apellidos VARCHAR(255) NOT NULL,
        fecha_nacimiento VARCHAR(50),
        lugar_nacimiento VARCHAR(150),
        tipo_documento VARCHAR(50),
        numero_documento VARCHAR(50) UNIQUE NOT NULL,
        edad INTEGER,
        sexo VARCHAR(20),
        nacionalidad VARCHAR(100),
        direccion TEXT,
        barrio VARCHAR(100),
        municipio VARCHAR(100),
        telefono_familiar VARCHAR(50),
        institucion_anterior VARCHAR(150),
        ultimo_grado_cursado VARCHAR(50),
        culmino_grado VARCHAR(10),
        estudio_antes_cedsea VARCHAR(10),
        eps VARCHAR(100),
        tipo_sangre VARCHAR(10),
        alergias VARCHAR(200),
        condicion_medica VARCHAR(300),
        drive_url TEXT,
        salon_id INTEGER REFERENCES salones(id) ON DELETE SET NULL,
        estado VARCHAR(20) DEFAULT 'Activo'
      );

      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS codigo_estudiante VARCHAR(100);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS codigo_cedsea VARCHAR(100);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS fecha_matricula VARCHAR(50);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS grado VARCHAR(50);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS anio_ingreso VARCHAR(10);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS fecha_nacimiento VARCHAR(50);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS lugar_nacimiento VARCHAR(150);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(50);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS edad INTEGER;
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS sexo VARCHAR(20);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS nacionalidad VARCHAR(100);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS direccion TEXT;
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS barrio VARCHAR(100);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS municipio VARCHAR(100);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS telefono_familiar VARCHAR(50);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS institucion_anterior VARCHAR(150);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS ultimo_grado_cursado VARCHAR(50);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS culmino_grado VARCHAR(10);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS estudio_antes_cedsea VARCHAR(10);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS eps VARCHAR(100);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS tipo_sangre VARCHAR(10);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS alergias VARCHAR(200);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS condicion_medica VARCHAR(300);
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS drive_url TEXT;
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS salon_id INTEGER REFERENCES salones(id) ON DELETE SET NULL;
      ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'Activo';
    `);
    console.log('Tabla "estudiantes" verificada/actualizada con éxito en PostgreSQL.');
  } catch (error) {
    console.error('Error al verificar/crear la tabla estudiantes:', error);
  }
};

// Ejecutar la verificación al cargar las rutas
inicializarTablaEstudiantes();

const normalizarEntero = (valor) => {
  if (valor === '' || valor === null || valor === undefined) return null;
  const num = Number(valor);
  return Number.isNaN(num) ? null : num;
};

// GET: Obtener todos los estudiantes con su información de salón opcional
estudiante.get('/', async (req, res) => {
  try {
    const query = `
      SELECT e.*, s.codigo as salon_codigo, s.nombre as salon_nombre 
      FROM estudiantes e 
      LEFT JOIN salones s ON e.salon_id = s.id 
      ORDER BY e.id DESC
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener los estudiantes' });
  }
});

// GET: Obtener un estudiante específico por ID (útil para el historial)
estudiante.get('/:id', async (req, res, next) => {
  // Evitar conflicto con rutas literales como /salon o /estudiante
  if (Number.isNaN(Number(req.params.id))) return next();

  try {
    const id = normalizarEntero(req.params.id);
    const query = `
      SELECT e.*, s.codigo as salon_codigo, s.nombre as salon_nombre
      FROM estudiantes e
      LEFT JOIN salones s ON e.salon_id = s.id
      WHERE e.id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el estudiante' });
  }
});

// GET: Obtener estudiantes de un salón específico (excluyendo a los inhabilitados para los docentes)
estudiante.get('/salon/:salonId', async (req, res) => {
  try {
    const { salonId } = req.params;
    const query = `
      SELECT * FROM estudiantes 
      WHERE salon_id = $1 
      AND (estado IS NULL OR estado != 'Inactivo') 
      ORDER BY id DESC
    `;
    const result = await pool.query(query, [salonId]);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener los estudiantes del salón' });
  }
});

// GET: Obtener acudientes de un estudiante específico por su ID
estudiante.get('/estudiante/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM acudientes WHERE estudiante_id = $1';
    const result = await pool.query(query, [id]);

    return res.json({
      success: true,
      acudientes: result.rows
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener los acudientes' });
  }
});

// POST: Registrar un nuevo estudiante (incluyendo salon_id y drive_url)
estudiante.post('/', async (req, res) => {
  try {
    const {
      codigo_estudiante, codigo_cedsea, fecha_matricula, grado, anio_ingreso,
      nombres_apellidos, fecha_nacimiento, lugar_nacimiento,
      tipo_documento, numero_documento, edad, sexo, nacionalidad,
      direccion, barrio, municipio, telefono_familiar,
      institucion_anterior, ultimo_grado_cursado, culmino_grado, estudio_antes_cedsea,
      eps, tipo_sangre, condicion_medica, alergias, drive_url, salon_id
    } = req.body;

    const query = `
      INSERT INTO estudiantes (
        codigo_estudiante, codigo_cedsea, fecha_matricula, grado, anio_ingreso,
        nombres_apellidos, fecha_nacimiento, lugar_nacimiento,
        tipo_documento, numero_documento, edad, sexo, nacionalidad,
        direccion, barrio, municipio, telefono_familiar,
        institucion_anterior, ultimo_grado_cursado, culmino_grado, estudio_antes_cedsea,
        eps, tipo_sangre, condicion_medica, alergias, drive_url, salon_id, estado
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, 'Activo'
      )
      RETURNING *;
    `;

    const values = [
      codigo_estudiante || null,
      codigo_cedsea || null,
      fecha_matricula || null,
      grado || null,
      anio_ingreso || null,
      nombres_apellidos,
      fecha_nacimiento || null,
      lugar_nacimiento || null,
      tipo_documento || null,
      numero_documento,
      normalizarEntero(edad),
      sexo || null,
      nacionalidad || null,
      direccion || null,
      barrio || null,
      municipio || null,
      telefono_familiar || null,
      institucion_anterior || null,
      ultimo_grado_cursado || null,
      culmino_grado || null,
      estudio_antes_cedsea || null,
      eps || null,
      tipo_sangre || null,
      condicion_medica || null,
      alergias || null,
      drive_url ? String(drive_url).trim() : null,
      normalizarEntero(salon_id)
    ];

    const nuevoEstudiante = await pool.query(query, values);
    return res.status(201).json(nuevoEstudiante.rows[0]);
  } catch (err) {
    console.error('Error al guardar estudiante:', err);
    return res.status(500).json({
      error: 'Error al registrar el estudiante en la base de datos',
      detalle: err.message
    });
  }
});

// PUT: Actualizar los datos de un estudiante existente
estudiante.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codigo_estudiante, codigo_cedsea, fecha_matricula, grado, anio_ingreso,
      nombres_apellidos, fecha_nacimiento, lugar_nacimiento,
      tipo_documento, numero_documento, edad, sexo, nacionalidad,
      direccion, barrio, municipio, telefono_familiar,
      institucion_anterior, ultimo_grado_cursado, culmino_grado, estudio_antes_cedsea,
      eps, tipo_sangre, condicion_medica, alergias, drive_url, salon_id
    } = req.body;

    const query = `
      UPDATE estudiantes SET 
        codigo_estudiante = $1, codigo_cedsea = $2, fecha_matricula = $3, grado = $4, anio_ingreso = $5,
        nombres_apellidos = $6, fecha_nacimiento = $7, lugar_nacimiento = $8,
        tipo_documento = $9, numero_documento = $10, edad = $11, sexo = $12, nacionalidad = $13,
        direccion = $14, barrio = $15, municipio = $16, telefono_familiar = $17,
        institucion_anterior = $18, ultimo_grado_cursado = $19, culmino_grado = $20, estudio_antes_cedsea = $21,
        eps = $22, tipo_sangre = $23, condicion_medica = $24, alergias = $25, drive_url = $26, salon_id = $27
      WHERE id = $28
      RETURNING *;
    `;

    const values = [
      codigo_estudiante || null,
      codigo_cedsea || null,
      fecha_matricula || null,
      grado || null,
      anio_ingreso || null,
      nombres_apellidos,
      fecha_nacimiento || null,
      lugar_nacimiento || null,
      tipo_documento || null,
      numero_documento,
      normalizarEntero(edad),
      sexo || null,
      nacionalidad || null,
      direccion || null,
      barrio || null,
      municipio || null,
      telefono_familiar || null,
      institucion_anterior || null,
      ultimo_grado_cursado || null,
      culmino_grado || null,
      estudio_antes_cedsea || null,
      eps || null,
      tipo_sangre || null,
      condicion_medica || null,
      alergias || null,
      drive_url ? String(drive_url).trim() : null,
      normalizarEntero(salon_id),
      normalizarEntero(id)
    ];

    const estudianteActualizado = await pool.query(query, values);

    if (estudianteActualizado.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    return res.json(estudianteActualizado.rows[0]);
  } catch (err) {
    console.error('Error al actualizar estudiante:', err);
    return res.status(500).json({
      error: 'Error al actualizar el estudiante en la base de datos',
      detalle: err.message
    });
  }
});

// PATCH: Guardar o actualizar el link de Google Drive del estudiante (para el historial)
estudiante.patch('/:id/drive', async (req, res) => {
  try {
    const id = normalizarEntero(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID de estudiante inválido' });
    }

    const { drive_url } = req.body;
    const urlLimpia = drive_url ? String(drive_url).trim() : null;

    const result = await pool.query(
      'UPDATE estudiantes SET drive_url = $1 WHERE id = $2 RETURNING id, drive_url',
      [urlLimpia, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    return res.json({
      mensaje: 'Enlace de Drive guardado correctamente',
      drive_url: result.rows[0].drive_url
    });
  } catch (err) {
    console.error('Error al guardar enlace de Drive:', err);
    return res.status(500).json({
      error: 'Error al guardar el enlace de Drive',
      detalle: err.message
    });
  }
});

// PATCH: Inhabilitar o Activar un estudiante (Cambiar estado)
estudiante.patch('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'Activo' o 'Inactivo'

    const query = `UPDATE estudiantes SET estado = $1 WHERE id = $2 RETURNING *;`;
    const result = await pool.query(query, [estado, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    return res.json({ mensaje: `Estudiante marcado como ${estado}`, estudiante: result.rows[0] });
  } catch (err) {
    console.error('Error al cambiar el estado del estudiante:', err);
    return res.status(500).json({ error: 'Error al cambiar el estado del estudiante' });
  }
});

module.exports = estudiante;