const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 🛑 LOS MIDDLEWARES GLOBALES DEBEN IR PRIMERO CON EL LÍMITE DE 50MB
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. IMPORTAR LAS RUTAS
const matriculaRoutes = require('./routes/matriculaRoutes');
const estudiantesRoutes = require('./routes/estudiantes');
const docenteRoutes = require('./routes/docenteRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const asignaturaRoutes = require('./routes/asignaturaRoutes');
const contabilidadRoutes = require('./routes/contabilidadRoutes');
const boletinRoutes = require('./routes/boletinRoutes');
const acudienteRoutes = require('./routes/acudienteRoutes');
const calificacionesRoutes = require('./routes/calificacionesRoutes');
const salonesRoutes = require('./routes/salonesRoutes');
const areasRoutes = require('./routes/areasRoutes');




// 3. REGISTRAR LOS PREFIJOS DE LAS RUTAS
app.use('/api/docentes', docenteRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/asignaturas', asignaturaRoutes);
app.use('/api/contabilidad', contabilidadRoutes);
app.use('/api/boletines', boletinRoutes);
app.use('/api/estudiantes', estudiantesRoutes);
app.use('/api/matriculas', matriculaRoutes);
app.use('/api/acudientes', acudienteRoutes);
app.use('/api', calificacionesRoutes);
app.use('/api/salones', salonesRoutes);
app.use('/api/areas', areasRoutes);


// 4. ARRANQUE DEL SERVIDOR
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});