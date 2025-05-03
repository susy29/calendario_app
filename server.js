const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const app = express();
const PORT = 3000;

// Cargar variables de entorno
require('dotenv').config();

// Conexión a MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eventos'
});

// Conectar
db.connect(err => {
  if (err) {
    console.error('Error al conectar a la base de datos MySQL:', err);
    return;
  }
  console.log('✅ Conexión exitosa a la base de datos MySQL');
});

app.use(bodyParser.json());
app.use(express.static('public'));

// Obtener eventos
app.get('/api/eventos', (req, res) => {
  db.query('SELECT * FROM eventos', (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

// Crear evento
app.post('/api/crear-evento', (req, res) => {
  const { titulo, fecha, hora, color, descripcion } = req.body;

  if (!titulo || !fecha || !hora || !color) {
    return res.status(400).json({ error: 'Todos los campos obligatorios' });
  }

  db.query(
    'INSERT INTO eventos (titulo, fecha, hora, color, descripcion) VALUES (?, ?, ?, ?, ?)',
    [titulo, fecha, hora, color, descripcion ],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.status(200).json({ id: result.insertId, mensaje: 'Evento creado correctamente' });
    }
  );
});
const revisarEventos = () => {
  const hoy = new Date();
  const unaSemanaDespues = new Date(hoy);
  unaSemanaDespues.setDate(hoy.getDate() + 7);

  const fechaLimite = unaSemanaDespues.toISOString().split('T')[0];

  db.query('SELECT * FROM eventos WHERE fecha = ? AND alerta_enviada = 0', [fechaLimite], (err, rows) => {
    if (err) return console.error('Error al verificar eventos:', err);
    rows.forEach(evento => {
      console.log(`🔔 Recordatorio: Falta 1 semana para el evento "${evento.titulo}" (${evento.fecha})`);

      // Marcar como notificado
      db.query('UPDATE eventos SET alerta_enviada = 1 WHERE id = ?', [evento.id]);
    });
  });
};

// Ejecutar cada hora (solo como ejemplo para pruebas rápidas)
setInterval(revisarEventos, 1000 * 60 * 60); // cada 1 hora


// Editar evento
app.put('/api/editar-evento/:id', (req, res) => {
  const id = req.params.id;
  const { titulo, fecha, hora, color, descripcion } = req.body;

  if (!titulo || !fecha || !hora || !color) {
    return res.status(400).json({ error: 'Todos los campos obligatorios' });
  }

  db.query(
    'UPDATE eventos SET titulo=?, fecha=?, hora=?, color=?, descripcion=?  WHERE id=?',
    [titulo, fecha, hora, color, descripcion || '', repetir || 'nunca', id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Evento no encontrado' });
      }
      res.status(200).json({ mensaje: 'Evento actualizado correctamente' });
    }
  );
});

// Eliminar evento
app.delete('/api/eliminar-evento/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM eventos WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).send(err);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    res.status(200).json({ mensaje: 'Evento eliminado correctamente' });
  });
});

// Cerrar sesión
app.post('/api/cerrar-sesion', (req, res) => {
  res.status(200).json({ mensaje: 'Sesión cerrada correctamente' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🌐 Servidor corriendo en http://localhost:${PORT}`);
});
