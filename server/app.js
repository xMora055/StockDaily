const express = require('express');
const { middlewareCors } = require('./config/cors');
const rutas = require('./rutas');
const { noEncontrado } = require('./middlewares/noEncontrado');
const { manejadorErrores } = require('./middlewares/manejadorErrores');

const app = express();

app.use(middlewareCors);
app.use(express.json());

app.use('/api/v1', rutas);

app.use(noEncontrado);
app.use(manejadorErrores);

module.exports = app;
