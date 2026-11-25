const express = require('express');
const router = express.Router();
const pool = require('../config/db');


const crearTablaAcudientes = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS acudientes (
      id SERIAL PRIMARY KEY,
      estudiante_id INTEGER REFERENCES estudiantes(id) ON DELETE CASCADE,
      nombre VARCHAR(255) NOT NULL,
      apellido VARCHAR(255) NOT NULL,
      parentesco VARCHAR(100),
      numero_documento VARCHAR(50),
      telefono VARCHAR(50),
      direccion VARCHAR(255)
    );
  `;
  try {
    await pool.query(query);
    console.log('Tabla "acudientes" verificada/creada con éxito en PostgreSQL.');
  } catch (err) {
    console.error('Error al crear la tabla acudientes:', err);
  }
};

// Llama a esta función al importar el archivo o al iniciar la app
crearTablaAcudientes();

// GET: Obtener acudientes por el ID del estudiante
// GET: Obtener acudientes filtrados exclusivamente por el ID del estudiante
router.get('/estudiante/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 💡 El 'WHERE estudiante_id = $1' es clave para que solo devuelva los del estudiante consultado
    const query = 'SELECT * FROM acudientes WHERE estudiante_id = $1';
    const result = await pool.query(query, [id]);

    return res.json({
      success: true,
      acudientes: result.rows
    });
  } catch (err) {
    console.error('Error al obtener acudientes:', err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { 
      estudiante_id, nombre, apellido, parentesco, 
      numero_documento, telefono, direccion 
    } = req.body;

    const query = `
      INSERT INTO acudientes (estudiante_id, nombre, apellido, parentesco, numero_documento, telefono, direccion)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [estudiante_id, nombre, apellido, parentesco, numero_documento, telefono, direccion];
    const nuevoAcudiente = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      acudiente: nuevoAcudiente.rows[0]
    });
  } catch (err) {
    console.error('Error al registrar acudiente:', err);
    return res.status(500).json({ error: err.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM acudientes WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Acudiente no encontrado' });
    }

    return res.json({ 
      success: true, 
      mensaje: 'Acudiente eliminado correctamente',
      acudienteEliminado: result.rows[0]
    });
  } catch (err) {
    console.error('Error en el servidor al eliminar acudiente:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;