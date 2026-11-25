const express = require('express');
const router = express.Router();
const MatriculaModel = require('../models/matriculaModel');

// GET: Listar matrículas
router.get('/', async (req, res) => {
    try {
        const matriculas = await MatriculaModel.getAll();
        res.status(200).json(matriculas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Registrar una matrícula
router.post('/', async (req, res) => {
    try {
        const nuevoId = await MatriculaModel.create(req.body);
        res.status(201).json({ id: nuevoId, message: 'Matrícula registrada exitosamente' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;