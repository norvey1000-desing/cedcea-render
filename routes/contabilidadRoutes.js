const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Asegurar que la tabla tenga el campo de documento del estudiante
const asegurarTabla = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transacciones_contables (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(20) NOT NULL,
                categoria VARCHAR(50) DEFAULT 'Pensión / Matrícula',
                monto DECIMAL(10, 2) NOT NULL,
                descripcion TEXT,
                estudiante_documento VARCHAR(50),
                fecha_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (err) {
        console.error('Error al verificar tabla contabilidad:', err);
    }
};
asegurarTabla();

// GET: Obtener todas las transacciones
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM transacciones_contables ORDER BY fecha_transaccion DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener transacciones' });
    }
});

// GET: Obtener pagos específicos de un estudiante por su documento
router.get('/estudiante/:documento', async (req, res) => {
    try {
        const { documento } = req.params;
        const result = await pool.query(
            'SELECT * FROM transacciones_contables WHERE estudiante_documento = $1 ORDER BY fecha_transaccion DESC',
            [documento]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener pagos del estudiante' });
    }
});

// POST: Registrar transacción general (Ingresos o Egresos independientes)
router.post('/', async (req, res) => {
    try {
        const { tipo, categoria, monto, descripcion, estudiante_documento } = req.body;
        
        const query = `
            INSERT INTO transacciones_contables (tipo, categoria, monto, descripcion, estudiante_documento)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [tipo, categoria || 'General', monto, descripcion, estudiante_documento || null];
        const nuevaTransaccion = await pool.query(query, values);

        res.status(201).json({
            mensaje: 'Transacción registrada exitosamente',
            transaccion: nuevaTransaccion.rows[0]
        });
    } catch (error) {
        console.error('Error al registrar la transacción general:', error);
        res.status(500).json({ error: 'No se pudo registrar la transacción: ' + error.message });
    }
});

// POST: Registrar pago de pensión validando el documento de forma segura
router.post('/pension', async (req, res) => {
    try {
        const { estudiante_documento, monto, mes, descripcion } = req.body;

        let estudianteCheck;
        try {
            estudianteCheck = await pool.query(
                'SELECT * FROM estudiantes WHERE documento = $1 OR numero_documento = $1 OR identificacion = $1',
                [estudiante_documento]
            );
        } catch (err) {
            estudianteCheck = await pool.query(
                'SELECT * FROM estudiantes WHERE numero_documento = $1',
                [estudiante_documento]
            );
        }

        if (estudianteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'El número de identificación no corresponde a ningún estudiante registrado.' });
        }

        const estudiante = estudianteCheck.rows[0];
        const nombreEstudiante = estudiante.nombres_apellidos || estudiante.nombre_completo || estudiante.nombre || 'Estudiante';

        const descCompleta = `Pensión - ${mes || 'Mensualidad'} (${nombreEstudiante}) - ${descripcion || ''}`;
        const query = `
            INSERT INTO transacciones_contables (tipo, categoria, monto, descripcion, estudiante_documento)
            VALUES ('INGRESO', 'Pensión Mensual', $1, $2, $3)
            RETURNING *;
        `;
        const values = [monto, descCompleta, estudiante_documento];
        const nuevaTransaccion = await pool.query(query, values);

        res.status(201).json({
            mensaje: 'Pago de pensión registrado exitosamente',
            transaccion: nuevaTransaccion.rows[0]
        });

    } catch (error) {
        console.error('Error detallado al registrar pago de pensión:', error);
        res.status(500).json({ error: 'Error interno al procesar el pago: ' + error.message });
    }
});

// POST: Registrar pago de nómina a docentes validando su documento de forma segura
router.post('/nomina', async (req, res) => {
    try {
        const { docente_documento, monto, mes, descripcion } = req.body;

        // Búsqueda flexible adaptada a las columnas reales de la tabla docentes
        let docenteCheck;
        try {
            docenteCheck = await pool.query(
                'SELECT * FROM docentes WHERE identificacion = $1 OR documento = $1',
                [docente_documento]
            );
        } catch (err) {
            try {
                docenteCheck = await pool.query(
                    'SELECT * FROM docentes WHERE identificacion = $1',
                    [docente_documento]
                );
            } catch (err2) {
                docenteCheck = await pool.query(
                    'SELECT * FROM docentes WHERE documento = $1',
                    [docente_documento]
                );
            }
        }

        if (!docenteCheck || docenteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'El número de identificación no corresponde a ningún docente registrado.' });
        }

        const docente = docenteCheck.rows[0];
        const nombreDocente = docente.nombres_apellidos || docente.nombre_completo || docente.nombre || 'Docente';

        // Registrar en contabilidad como EGRESO vinculado a la nómina
        const descCompleta = `Nómina - ${mes || 'Mes Actual'} (${nombreDocente}) - ${descripcion || ''}`;
        const query = `
            INSERT INTO transacciones_contables (tipo, categoria, monto, descripcion, estudiante_documento)
            VALUES ('EGRESO', 'Nómina Docentes', $1, $2, $3)
            RETURNING *;
        `;
        const values = [monto, descCompleta, docente_documento];
        const nuevaTransaccion = await pool.query(query, values);

        res.status(201).json({
            mensaje: 'Pago de nómina registrado exitosamente',
            transaccion: nuevaTransaccion.rows[0]
        });

    } catch (error) {
        console.error('Error detallado al registrar pago de nómina:', error);
        res.status(500).json({ error: 'Error interno al procesar la nómina: ' + error.message });
    }
});

module.exports = router;