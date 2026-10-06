const cors = require('cors');
const { entorno } = require('./entorno');

// CORS restringido al frontend configurado en CLIENT_URL.
const middlewareCors = cors({
    origin: entorno.clientUrl,
    credentials: true,
});

module.exports = { middlewareCors };
