let fechaActual = new Date();
const diasContenedor = document.getElementById("dias");
const mesAnio = document.getElementById("mesAnio");
const listaEventos = document.getElementById("lista-eventos");
let eventos = [];
let idEditando = null;

// Configuración de URL del servidor
let SERVER_URL = window.location.origin || 'http://192.168.1.64:3000';

// Obtener usuario actual o pedirlo
let usuario = localStorage.getItem("usuario");
if (!usuario) {
  usuario = prompt("Escribe tu nombre de usuario:");
  localStorage.setItem("usuario", usuario);
}

// Evento de carga del documento
document.addEventListener('DOMContentLoaded', () => {
  // Mostrar nombre de usuario
  document.getElementById("usuario-nombre").textContent = `👤 ${usuario}`;
  
  // Configuración del menú desplegable
  const usuarioNombre = document.getElementById("usuario-nombre");
  const menuUsuario = document.getElementById("menu-usuario");

  // Event listener para alternar menú
  usuarioNombre.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevenir que el evento se propague
    menuUsuario.style.display = menuUsuario.style.display === 'block' ? 'none' : 'block';
  });

  // Cerrar el menú si se hace clic fuera de él
  document.addEventListener('click', (event) => {
    if (!usuarioNombre.contains(event.target) && !menuUsuario.contains(event.target)) {
      menuUsuario.style.display = 'none';
    }
  });

  // Configurar botón de cerrar sesión
  const btnCerrar = document.querySelector(".cerrar-btn");
  btnCerrar.addEventListener("click", cerrarSesion);

  // Cargar eventos y registrar notificaciones
  cargarEventos();
  registrarNotificacionesPush();
});

function cargarEventos() {
  fetch(`${SERVER_URL}/api/eventos?usuario=${usuario}`)
    .then(res => {
      console.log('Respuesta del servidor:', res);
      return res.json();
    })
    .then(data => {
      console.log('Eventos recibidos:', data);
      eventos = data;
      renderizarCalendario();
      mostrarEventos();
    })
    .catch(err => {
      console.error('Error al cargar eventos:', err);
      alert("❌ Error al cargar eventos: " + err.message);
    });
}

function renderizarCalendario() {
  const anio = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);
  const inicio = primerDia.getDay();

  mesAnio.textContent = primerDia.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  diasContenedor.innerHTML = "";

  for (let i = 0; i < inicio; i++) {
    diasContenedor.innerHTML += `<span></span>`;
  }

  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    const evento = eventos.find(e => e.fecha.split('T')[0] === fechaStr);
    
    if (evento) {
      diasContenedor.innerHTML += `<span onclick="mostrarEventosDia('${fechaStr}')" class="evento color-${evento.color}">${d}</span>`;
    } else {
      diasContenedor.innerHTML += `<span>${d}</span>`;
    }
  }
}

function mostrarEventosDia(fecha) {
  const eventosDia = eventos.filter(e => e.fecha.split('T')[0] === fecha);
  
  const modal = document.createElement('div');
  modal.className = 'modal-eventos';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    z-index: 1000;
    max-width: 400px;
    width: 90%;
  `;
  
  let contenidoModal = `
    <h3>Eventos del ${new Date(fecha).toLocaleDateString('es-MX', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}</h3>
    <hr style="margin: 15px 0;">
  `;
  
  if (eventosDia.length === 0) {
    contenidoModal += '<p>No hay eventos este día</p>';
  } else {
    eventosDia.forEach(e => {
      contenidoModal += `
        <div class="evento-modal color-${e.color}" style="margin-bottom: 15px; padding: 10px; border-radius: 8px;">
          <h4 style="margin: 0; color: #333;">${e.titulo}</h4>
          <p style="color: #666; font-size: 0.9em;">🕒 ${e.hora}</p>
          ${e.descripcion ? `<p style="color: #555; margin-top: 5px;">${e.descripcion}</p>` : ""}
          ${e.archivo ? `<a href="uploads/${e.archivo}" target="_blank" style="color: #3b82f6; text-decoration: none;">📎 Ver archivo</a>` : ""}
        </div>
      `;
    });
  }
  
  contenidoModal += `
    <button onclick="this.parentElement.remove()" 
            style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 10px;">
      Cerrar
    </button>
  `;
  
  modal.innerHTML = contenidoModal;
  document.body.appendChild(modal);
}

function mostrarEventos() {
  listaEventos.innerHTML = "";
  eventos.forEach(e => {
    listaEventos.innerHTML += `
      <li class="evento-item color-${e.color}">
        <div>
          <strong>${e.titulo}</strong>
          <span class="fecha">${new Date(e.fecha).toLocaleDateString('es-MX')} • ${e.hora}</span>
          ${e.descripcion ? `<p>${e.descripcion}</p>` : ""}
          ${e.archivo ? `<a href="uploads/${e.archivo}" target="_blank">📎 Ver archivo</a>` : ""}
        </div>
        <div class="acciones">
          <button onclick="editarEvento(${e.id})">✏️</button>
          <button onclick="eliminarEvento(${e.id})">🗑</button>
        </div>
      </li>
    `;
  });
}

function cambiarMes(valor) {
  fechaActual.setMonth(fechaActual.getMonth() + valor);
  renderizarCalendario();
}

document.getElementById('form-evento').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  formData.append("usuario", usuario);

  const url = idEditando 
    ? `${SERVER_URL}/api/editar-evento/${idEditando}` 
    : `${SERVER_URL}/api/crear-evento`;
  const method = idEditando ? 'PUT' : 'POST';

  fetch(url, {
    method,
    body: formData
  })
  .then(res => {
    if (res.ok) {
      alert(idEditando ? "✅ Evento editado" : "✅ Evento creado");
      form.reset();
      idEditando = null;
      cargarEventos();

      // Enviar notificación push si es un nuevo evento
      if (!idEditando) {
        const titulo = formData.get('titulo');
        const fechaEvento = formData.get('fecha');
        enviarNotificacion(`Nuevo Evento`, `${titulo} el ${fechaEvento}`);
      }
    } else {
      return res.json().then(data => {
        throw new Error(data.error || "Error desconocido");
      });
    }
  })
  .catch(err => {
    alert("❌ Error: " + err.message);
  });
});

function editarEvento(id) {
  const e = eventos.find(ev => ev.id === id);
  if (!e) return;

  document.getElementById('titulo').value = e.titulo;
  document.getElementById('fecha').value = e.fecha.split("T")[0];
  document.getElementById('hora').value = e.hora;
  document.getElementById('color').value = e.color;
  document.getElementById('descripcion').value = e.descripcion || "";
  idEditando = id;
}

function eliminarEvento(id) {
  if (!confirm("¿Eliminar este evento?")) return;
  fetch(`${SERVER_URL}/api/eliminar-evento/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario })
  })
  .then(res => {
    if (res.ok) {
      alert("🗑 Evento eliminado");
      cargarEventos();
    } else {
      throw new Error("No se pudo eliminar");
    }
  })
  .catch(err => alert("❌ " + err.message));
}

function cerrarSesion() {
  localStorage.removeItem("usuario");
  window.location.href = "index.html";
}

// Detectar si es móvil
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Clave pública VAPID
const publicVapidKey = 'BElMY1R02v9Af97QrzTf5iksSFYMZUZpESWMqD04KPJ68iKbdUFiCrbI-MxFGe78QZ30US0T3Fp-uUngT7JHTIA'; 

// Convertir clave VAPID base64
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Función para registrar notificaciones push solo en móviles
async function registrarNotificacionesPush() {
  // Verificar si es un dispositivo móvil
  if (!isMobile()) {
    console.log('No es un dispositivo móvil. Notificaciones push desactivadas.');
    return;
  }

  // Verificar soporte de Service Worker y notificaciones
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push no soportado');
    return;
  }

  try {
    // Registrar Service Worker
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('Service Worker registrado');

    // Solicitar permiso de notificaciones
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      console.log('Permiso de notificaciones denegado');
      return;
    }

    // Suscribirse a notificaciones push
    const suscripcion = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });

    // Enviar suscripción al servidor
    await fetch(`${SERVER_URL}/api/save-subscription?usuario=${usuario}`, {
      method: 'POST',
      body: JSON.stringify(suscripcion),
      headers: {
        'content-type': 'application/json'
      }
    });

    console.log('Notificaciones push registradas para móvil');
  } catch (error) {
    console.error('Error al registrar notificaciones push:', error);
  }
}

// Función para enviar notificación (lado del cliente)
async function enviarNotificacion(titulo, mensaje) {
  if (!isMobile()) {
    console.log('Solo se envían notificaciones en dispositivos móviles');
    return;
  }

  try {
    const response = await fetch(`${SERVER_URL}/api/enviar-notificacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        titulo: titulo,
        mensaje: mensaje,
        usuario: usuario
      })
    });

    if (!response.ok) {
      throw new Error('Error al enviar notificación');
    }

    console.log('Notificación enviada');
  } catch (error) {
    console.error('Error:', error);
  }
}
