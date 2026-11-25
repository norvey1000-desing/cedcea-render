const db = require('../config/db');

const MatriculaModel = {
    // Obtener todas las matrículas haciendo JOIN con estudiantes y cursos
    async getAll() {
        const [rows] = await db.query(`
            SELECT m.id, u.nombre AS estudiante, c.nombre AS curso, m.anio_lectivo, m.estado 
            FROM matriculas m
            JOIN usuarios u ON m.estudiante_id = u.id
            JOIN cursos c ON m.curso_id = c.id
        `);
        return rows;
    },

    // Crear una nueva matrícula validando que no exista una duplicada
    async create(data) {
        const { estudiante_id, curso_id, anio_lectivo } = data;

        // Validar si ya está matriculado en el mismo año
        const [existing] = await db.query(
            'SELECT id FROM matriculas WHERE estudiante_id = ? AND anio_lectivo = ?',
            [estudiante_id, anio_lectivo]
        );

        if (existing.length > 0) {
            throw new Error('El estudiante ya cuenta con una matrícula activa para este año lectivo.');
        }

        const [result] = await db.query(
            'INSERT INTO matriculas (estudiante_id, curso_id, anio_lectivo) VALUES (?, ?, ?)',
            [estudiante_id, curso_id, anio_lectivo]
        );

        return result.insertId;
    }
};

module.exports = MatriculaModel;