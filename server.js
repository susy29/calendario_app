const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const cron = require('node-cron');
const cors = require('cors');
const webPush = require('web-push');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Configurar claves VAPID
const vapidKeys = {
  publicKey: 'BElMY1R02v9Af97QrzTf5iksSFYMZUZpESWMqD04KPJ68iKbdUFiCrbI-MxFGe78QZ30US0T3Fp-uUngT7JHTIA',
  privateKey: '8t7aAxFzS94u2bFPTw5lPqe4qorBOS67hLqlJ-eqH9I'
};

webPush.setVapidDetails(
  'mailto:tu-email@ejemplo.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Almacenar suscripciones de push 
const subscriptions = new Map();

// Configuración de almacenamiento para archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Conexión a MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eventos'
});

db.connect(err => {
  if (err) {
    console.error('❌ Error al conectar a la base de datos MySQL:', err);
    return;
  }
  console.log('✅ Conexión exitosa a la base de datos MySQL');
});

// Middlewares
app.use(cors({
  origin: '*', // Permitir todas las conexiones
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Obtener eventos por usuario
app.get('/api/eventos', (req, res) => {
  const usuario = req.query.usuario;
  if (!usuario) return res.status(400).json({ error: 'Usuario no proporcionado' });
  db.query('SELECT * FROM eventos WHERE usuario = ?', [usuario], (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

// Crear evento
app.post('/api/crear-evento', upload.single('archivo'), (req, res) => {
  const { titulo, fecha, hora, color, descripcion, repetir, usuario } = req.body;
  const archivo = req.file ? req.file.filename : null;

  if (!titulo || !fecha || !hora || !color || !usuario) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const sql = `INSERT INTO eventos (usuario, titulo, fecha, hora, color, descripcion, repetir, archivo)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [usuario, titulo, fecha, hora, color, descripcion || '', repetir || 'nunca', archivo], (err, result) => {
    if (err) return res.status(500).send(err);
    
    // Enviar notificación push
    sendNotificationToUser(usuario, {
      title: 'Evento creado',
      body: `Tu evento "${titulo}" ha sido registrado para el ${fecha}`,
      icon: '/icon.png'
    });
    
    res.status(200).json({ id: result.insertId, mensaje: 'Evento creado correctamente' });
  });
});

// Editar evento
app.put('/api/editar-evento/:id', upload.single('archivo'), (req, res) => {
  const id = req.params.id;
  const { titulo, fecha, hora, color, descripcion, repetir, usuario } = req.body;
  const archivo = req.file ? req.file.filename : null;

  if (!titulo || !fecha || !hora || !color || !usuario) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const sql = archivo
    ? `UPDATE eventos SET titulo=?, fecha=?, hora=?, color=?, descripcion=?, repetir=?, archivo=? WHERE id=? AND usuario=?`
    : `UPDATE eventos SET titulo=?, fecha=?, hora=?, color=?, descripcion=?, repetir=? WHERE id=? AND usuario=?`;

  const params = archivo
    ? [titulo, fecha, hora, color, descripcion || '', repetir || 'nunca', archivo, id, usuario]
    : [titulo, fecha, hora, color, descripcion || '', repetir || 'nunca', id, usuario];

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).send(err);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    
    // Enviar notificación push
    sendNotificationToUser(usuario, {
      title: 'Evento actualizado',
      body: `Tu evento "${titulo}" ha sido modificado`,
      icon: '/icon.png'
    });
    
    res.status(200).json({ mensaje: 'Evento actualizado correctamente' });
  });
});

// Eliminar evento
app.delete('/api/eliminar-evento/:id', (req, res) => {
  const id = req.params.id;
  const usuario = req.body.usuario;
  if (!usuario) return res.status(400).json({ error: 'Usuario requerido' });

  db.query('DELETE FROM eventos WHERE id = ? AND usuario = ?', [id, usuario], (err, result) => {
    if (err) return res.status(500).send(err);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    res.status(200).json({ mensaje: 'Evento eliminado correctamente' });
  });
});

// Guardar suscripción push
app.post('/api/save-subscription', (req, res) => {
  const subscription = req.body;
  const usuario = req.query.usuario || req.body.usuario;
  
  if (!subscriptions.has(usuario)) {
    subscriptions.set(usuario, []);
  }
  
  subscriptions.get(usuario).push(subscription);
  res.status(201).json({});
});

// Función para enviar notificación a un usuario
function sendNotificationToUser(usuario, payload) {
  const userSubscriptions = subscriptions.get(usuario) || [];
  const notificationPayload = JSON.stringify(payload);
  
  userSubscriptions.forEach(subscription => {
    webPush.sendNotification(subscription, notificationPayload)
      .catch(err => {
        console.error('Error enviando notificación:', err);
        // Si hay error 410, eliminar la suscripción expirada
        if (err.statusCode === 410) {
          const index = userSubscriptions.indexOf(subscription);
          if (index > -1) {
            userSubscriptions.splice(index, 1);
          }
        }
      });
  });
}

// Notificaciones programadas
cron.schedule('0 9 * * *', () => {
  const hoy = new Date();
  const semanaDespues = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 7);
  const fechaNotificacion = semanaDespues.toISOString().split('T')[0];

  db.query('SELECT * FROM eventos WHERE fecha = ?', [fechaNotificacion], (err, eventos) => {
    if (err) return console.error('❌ Error en notificaciones:', err);
    eventos.forEach(evento => {
      console.log(`🔔 Recordatorio: "${evento.titulo}" para el usuario ${evento.usuario} es en una semana.`);
      
      // Enviar notificación push
      sendNotificationToUser(evento.usuario, {
        title: 'Recordatorio de evento',
        body: `Tu evento "${evento.titulo}" es en una semana`,
        icon: '/icon.png'
      });
    });
  });
});

app.use(express.static('public'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://192.168.1.64:${PORT}`);
});
