let fechaActual = new Date();
const diasContenedor = document.getElementById("dias");
const mesAnio = document.getElementById("mesAnio");
const listaEventos = document.getElementById("lista-eventos");
let eventos = [];
let idEditando = null;

function cargarEventos() {
  fetch('/api/eventos')
    .then(res => res.json())
    .then(data => {
      eventos = data;
      renderizarCalendario();
      mostrarEventos();
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
    const tieneEvento = eventos.some(e => {
      const evFecha = new Date(e.fecha).toISOString().split('T')[0];
      return evFecha === fechaStr;
    });
    diasContenedor.innerHTML += `<span class="${tieneEvento ? 'evento' : ''}">${d}</span>`;
  }
}

function mostrarEventos() {
  listaEventos.innerHTML = "";
  eventos.forEach(e => {
    listaEventos.innerHTML += `
      <li class="evento ${e.color}">
        <div>
          <strong>${e.titulo}</strong>
          <span class="fecha">${new Date(e.fecha).toLocaleDateString('es-MX')} • ${e.hora}</span>
        </div>
        <div class="acciones">
          <button onclick="editarEvento(${e.id})">✏️ Editar</button>
          <button onclick="eliminarEvento(${e.id})">🗑 Eliminar</button>
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

  const data = {
    titulo: document.getElementById('titulo').value,
    fecha: document.getElementById('fecha').value,
    hora: document.getElementById('hora').value,
    color: document.getElementById('color').value,
    descripcion: document.getElementById('descripcion').value,
  };
  
  const url = idEditando ? `/api/editar-evento/${idEditando}` : '/api/crear-evento';
  const method = idEditando ? 'PUT' : 'POST';

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => {
    if (res.ok) {
      alert(idEditando ? 'Evento actualizado ✅' : 'Evento guardado ✅');
      cargarEventos();
      e.target.reset();
      idEditando = null;
    } else {
      return res.json().then(err => { throw new Error(err.error || 'Error al guardar'); });
    }
  })
  .catch(err => {
    alert(`❌ Error al guardar el evento: ${err.message}`);
  });
});

function editarEvento(id) {
  const evento = eventos.find(e => e.id === id);
  if (!evento) return;

  document.getElementById('titulo').value = evento.titulo;
  document.getElementById('fecha').value = evento.fecha;
  document.getElementById('hora').value = evento.hora;
  document.getElementById('color').value = evento.color;
  document.getElementById('descripcion').value = evento.descripcion || '';
  idEditando = id;
}

function eliminarEvento(id) {
  if (!confirm('¿Estás seguro de eliminar este evento?')) return;

  fetch(`/api/eliminar-evento/${id}`, {
    method: 'DELETE'
  })
  .then(res => {
    if (res.ok) {
      alert('Evento eliminado 🗑');
      cargarEventos();
    } else {
      alert('Error al eliminar el evento');
    }
  });
}

function cerrarSesion() {
  localStorage.removeItem("usuario");
  window.location.href = "index.html";
}

document.addEventListener('DOMContentLoaded', () => {
  cargarEventos();
  const btnCerrar = document.querySelector(".cerrar-btn");
  if (btnCerrar) {
    btnCerrar.addEventListener("click", cerrarSesion);
  }
});
