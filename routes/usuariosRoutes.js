const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Función para verificar y crear la tabla automáticamente si no existe
const crearTablaUsuarios = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        docente_id INT REFERENCES docentes(id) ON DELETE SET NULL,
        nombre VARCHAR(150),
        usuario VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(50) NOT NULL DEFAULT 'docente'
      );
    `;
    await pool.query(query);

    const checkQuery = 'SELECT * FROM usuarios WHERE usuario = $1';
    const existing = await pool.query(checkQuery, ['admin']);
    
    if (existing.rows.length === 0) {
      const insertQuery = `
        INSERT INTO usuarios (docente_id, nombre, usuario, password, rol) 
        VALUES (NULL, 'Administrador', 'admin', '123456', 'administrador');
      `;
      await pool.query(insertQuery);
      console.log('👤 Usuario administrador por defecto creado: admin / 123456');
    }
  } catch (error) {
    console.error('❌ Error al crear la tabla usuarios:', error);
  }
};

crearTablaUsuarios();

// 1. Obtener todos los usuarios (con manejo de errores detallado)
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.docente_id, u.usuario, u.rol, 
             COALESCE(d.nombre_completo, u.nombre, 'Sin Asignar') AS nombre 
      FROM usuarios u 
      LEFT JOIN docentes d ON u.docente_id = d.id 
      ORDER BY u.id ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error detallado al obtener usuarios:', error);
    // 👈 Esto enviará el error real a la pestaña Network de tu navegador
    res.status(500).json({ 
      error: 'Error al obtener los usuarios', 
      detalle: error.message,
      codigo: error.code 
    });
  }
});

// 2. Crear un nuevo usuario
router.post('/', async (req, res) => {
  const { docente_id, nombre, usuario, password, rol } = req.body;
  try {
    const query = `
      INSERT INTO usuarios (docente_id, nombre, usuario, password, rol) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id, docente_id, nombre, usuario, rol;
    `;
    const result = await pool.query(query, [
      docente_id || null, 
      nombre || null, 
      usuario, 
      password, 
      rol || 'docente'
    ]);
    res.json({ success: true, mensaje: 'Usuario creado con éxito', usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear el usuario', detalle: error.message });
  }
});

// 4. Iniciar sesión / Autenticación
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  try {
    const query = `
      SELECT u.id, u.docente_id, u.usuario, u.rol, 
             COALESCE(d.nombre_completo, u.nombre, 'Sin Asignar') AS nombre 
      FROM usuarios u 
      LEFT JOIN docentes d ON u.docente_id = d.id 
      WHERE u.usuario = $1 AND u.password = $2;
    `;
    const result = await pool.query(query, [usuario, password]);
    
    if (result.rows.length > 0) {
      res.json({ success: true, mensaje: 'Autenticación exitosa', usuario: result.rows[0] });
    } else {
      res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ error: 'Error en el servidor', detalle: error.message });
  }
});

// 3. Eliminar usuario
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.json({ success: true, mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar el usuario', detalle: error.message });
  }
});

// 5. Actualizar usuario
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { docente_id, nombre, usuario, password, rol } = req.body;
    
    const query = `
      UPDATE usuarios 
      SET docente_id = $1, nombre = $2, usuario = $3, password = $4, rol = $5 
      WHERE id = $6 
      RETURNING id, docente_id, nombre, usuario, rol;
    `;
    const result = await pool.query(query, [docente_id || null, nombre || null, usuario, password, rol, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    res.json({ success: true, mensaje: 'Usuario actualizado correctamente', usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
  }
});

module.exports = router;