// ============================================================
// APP.JS - PAB PELUQUERÍA - Lógica principal
// ============================================================

import { auth, db, ADMIN_EMAIL } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { SERVICIOS, HORARIOS } from "./data.js";

// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentUser = null;
let currentUserData = null;
let allAppointments = [];
let allUsers = [];

// ============================================================
// NAVEGACIÓN
// ============================================================
window.showPage = function(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  window.scrollTo(0, 0);
};

window.scrollToServices = function() {
  document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
};

window.switchTab = function(tabId, btn) {
  const parent = btn.closest('.dashboard-container, .admin-container');
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');

  // Cargar datos al cambiar tab
  if (tabId === 'tab-appointments') loadUserAppointments();
  if (tabId === 'admin-tab-appointments') loadAllAppointments();
  if (tabId === 'admin-tab-users') loadAllUsers();
};

window.closeModal = function(id) {
  document.getElementById(id).style.display = 'none';
};

// ============================================================
// AUTH STATE
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUserData = userDoc.data();
      if (currentUserData.role === 'admin') {
        showPage('page-admin');
        loadAllAppointments();
      } else {
        document.getElementById('user-greeting').textContent = `Hola, ${currentUserData.name}!`;
        showPage('page-dashboard');
      }
    }
  } else {
    currentUser = null;
    currentUserData = null;
  }
});

// ============================================================
// REGISTRO
// ============================================================
window.handleRegister = async function() {
  const name = document.getElementById('reg-name').value.trim();
  const lastname = document.getElementById('reg-lastname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('register-error');

  errEl.style.display = 'none';

  if (!name || !lastname || !email || !password) {
    errEl.textContent = 'Por favor completa todos los campos obligatorios.';
    errEl.style.display = 'block';
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'La contraseña debe tener mínimo 6 caracteres.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const role = email === ADMIN_EMAIL ? 'admin' : 'cliente';

    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      name, lastname, email, phone, role,
      createdAt: serverTimestamp()
    });

    // Enviar correo mediante API + Resend
    sendEmail('nuevo_usuario', {
      userName: `${name} ${lastname}`,
      userEmail: email,
      phone
    });

  } catch (e) {
    errEl.textContent = firebaseError(e.code);
    errEl.style.display = 'block';
  }
};

// ============================================================
// LOGIN
// ============================================================
window.handleLogin = async function() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent = 'Ingresa tu correo y contraseña.';
    errEl.style.display = 'block';
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    errEl.textContent = firebaseError(e.code);
    errEl.style.display = 'block';
  }
};

// ============================================================
// LOGOUT
// ============================================================
window.handleLogout = async function() {
  await signOut(auth);
  showPage('page-landing');
};

// ============================================================
// AGENDAR CITA (CLIENTE)
// ============================================================
window.handleBooking = async function() {
  const service = document.getElementById('book-service').value;
  const date = document.getElementById('book-date').value;
  const time = document.getElementById('book-time').value;
  const note = document.getElementById('book-note').value;
  const errEl = document.getElementById('book-error');
  const sucEl = document.getElementById('book-success');

  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (!service || !date || !time) {
    errEl.textContent = 'Selecciona servicio, fecha y hora.';
    errEl.style.display = 'block';
    return;
  }

  const selectedDate = new Date(date + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  if (selectedDate < today) {
    errEl.textContent = 'No puedes agendar una cita en una fecha pasada.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const apptData = {
      userId: currentUser.uid,
      userName: `${currentUserData.name} ${currentUserData.lastname}`,
      userEmail: currentUser.email,
      userPhone: currentUserData.phone || '',
      service, date, time, note,
      status: 'pendiente',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'appointments'), apptData);

    // Notificar via sendEmail webhook → correo al cliente y al admin
    sendEmail('nueva_cita', {
      appointmentId: docRef.id,
      userName: apptData.userName,
      userEmail: apptData.userEmail,
      userPhone: apptData.userPhone,
      service, date, time, note,
      adminEmail: ADMIN_EMAIL
    });

    sucEl.textContent = `✅ ¡Cita agendada! ${service} el ${formatDate(date)} a las ${time}. Recibirás confirmación por correo.`;
    sucEl.style.display = 'block';

    // Limpiar formulario
    document.getElementById('book-service').value = '';
    document.getElementById('book-date').value = '';
    document.getElementById('book-time').value = '';
    document.getElementById('book-note').value = '';

  } catch (e) {
    errEl.textContent = 'Error al agendar. Intenta de nuevo.';
    errEl.style.display = 'block';
    console.error(e);
  }
};

// ============================================================
// CARGAR CITAS DEL USUARIO
// ============================================================
window.loadUserAppointments = async function() {
  const container = document.getElementById('user-appointments-list');
  container.innerHTML = '<div class="loading">Cargando tus citas...</div>';

  try {
    const q = query(
      collection(db, 'appointments'),
      where('userId', '==', currentUser.uid),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (appts.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">📅</div><p>No tienes citas agendadas aún.<br/>¡Agenda tu primera cita!</p></div>`;
      return;
    }

    container.innerHTML = appts.map(a => `
      <div class="appt-card ${a.status}">
        <div class="appt-info">
          <h4>${a.service}</h4>
          <p>📅 ${formatDate(a.date)} — ⏰ ${a.time}</p>
          ${a.note ? `<p>📝 ${a.note}</p>` : ''}
          <span class="status-badge status-${a.status}">${a.status}</span>
        </div>
        <div class="appt-actions">
          ${a.status === 'pendiente' ? `<button class="btn-danger" onclick="cancelUserAppointment('${a.id}')">Cancelar</button>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div class="loading">Error al cargar citas.</div>';
    console.error(e);
  }
};

window.cancelUserAppointment = async function(id) {
  if (!confirm('¿Cancelar esta cita?')) return;
  await updateDoc(doc(db, 'appointments', id), { status: 'cancelada' });
  loadUserAppointments();
};

// ============================================================
// ADMIN - CARGAR TODAS LAS CITAS
// ============================================================
window.loadAllAppointments = async function() {
  const container = document.getElementById('all-appointments-list');
  container.innerHTML = '<div class="loading">Cargando citas...</div>';

  try {
    const snap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc')));
    allAppointments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAppointments(allAppointments);
  } catch (e) {
    container.innerHTML = '<div class="loading">Error al cargar.</div>';
    console.error(e);
  }
};

window.filterAppointments = function() {
  const status = document.getElementById('filter-status').value;
  const date = document.getElementById('filter-date').value;
  let filtered = allAppointments;
  if (status) filtered = filtered.filter(a => a.status === status);
  if (date) filtered = filtered.filter(a => a.date === date);
  renderAppointments(filtered);
};

function renderAppointments(appts) {
  const container = document.getElementById('all-appointments-list');
  if (appts.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">📭</div><p>No hay citas que mostrar.</p></div>`;
    return;
  }
  container.innerHTML = appts.map(a => `
    <div class="appt-card ${a.status}">
      <div class="appt-info">
        <span class="client-name">👤 ${a.userName}</span>
        <h4>${a.service}</h4>
        <p>📅 ${formatDate(a.date)} — ⏰ ${a.time}</p>
        <p>📧 ${a.userEmail} ${a.userPhone ? '| 📱 ' + a.userPhone : ''}</p>
        ${a.note ? `<p>📝 ${a.note}</p>` : ''}
        <span class="status-badge status-${a.status}">${a.status}</span>
      </div>
      <div class="appt-actions">
        <button class="btn-edit" onclick="openEditAppointment('${a.id}')">✏️ Editar</button>
        ${a.status === 'pendiente' ? `<button class="btn-confirm" onclick="confirmAppointment('${a.id}', '${a.userEmail}', '${a.userName}', '${a.service}', '${a.date}', '${a.time}')">✓ Confirmar</button>` : ''}
        <button class="btn-danger" onclick="deleteAppointment('${a.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

window.openEditAppointment = function(id) {
  const a = allAppointments.find(x => x.id === id);
  if (!a) return;
  document.getElementById('edit-appointment-id').value = id;
  document.getElementById('edit-service').value = a.service;
  document.getElementById('edit-date').value = a.date;
  document.getElementById('edit-time').value = a.time;
  document.getElementById('edit-status').value = a.status;
  document.getElementById('edit-note').value = a.note || '';
  document.getElementById('modal-edit-appointment').style.display = 'flex';
};

window.saveEditAppointment = async function() {
  const id = document.getElementById('edit-appointment-id').value;
  const data = {
    service: document.getElementById('edit-service').value,
    date: document.getElementById('edit-date').value,
    time: document.getElementById('edit-time').value,
    status: document.getElementById('edit-status').value,
    note: document.getElementById('edit-note').value,
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, 'appointments', id), data);
  closeModal('modal-edit-appointment');
  loadAllAppointments();
};

window.confirmAppointment = async function(id, email, name, service, date, time) {
  await updateDoc(doc(db, 'appointments', id), { status: 'confirmada' });

  sendEmail('cita_confirmada', {
    userEmail: email,
    userName: name,
    service, date, time,
    adminEmail: ADMIN_EMAIL
  });

  loadAllAppointments();
};

window.deleteAppointment = async function(id) {
  if (!confirm('¿Eliminar esta cita permanentemente?')) return;
  await deleteDoc(doc(db, 'appointments', id));
  loadAllAppointments();
};

// ============================================================
// ADMIN - CARGAR USUARIOS
// ============================================================
window.loadAllUsers = async function() {
  const container = document.getElementById('all-users-list');
  container.innerHTML = '<div class="loading">Cargando usuarios...</div>';

  try {
    const snap = await getDocs(collection(db, 'users'));
    allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (allUsers.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">👥</div><p>No hay usuarios registrados aún.</p></div>`;
      return;
    }

    container.innerHTML = allUsers.map(u => `
      <div class="user-card">
        <div class="user-avatar">${u.name ? u.name[0].toUpperCase() : '?'}</div>
        <div class="user-info">
          <h4>${u.name} ${u.lastname || ''} ${u.role === 'admin' ? '👑' : ''}</h4>
          <p>📧 ${u.email} ${u.phone ? '| 📱 ' + u.phone : ''}</p>
          <p>Registrado: ${u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString('es-CO') : 'N/A'}</p>
        </div>
        <div class="user-actions">
          <button class="btn-edit" onclick="openEditUser('${u.id}')">✏️ Editar</button>
          ${u.email !== ADMIN_EMAIL ? `<button class="btn-danger" onclick="deleteUser('${u.id}')">🗑️</button>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div class="loading">Error al cargar usuarios.</div>';
    console.error(e);
  }
};

window.openEditUser = function(id) {
  const u = allUsers.find(x => x.id === id);
  if (!u) return;
  document.getElementById('edit-user-id').value = id;
  document.getElementById('edit-user-name').value = u.name || '';
  document.getElementById('edit-user-lastname').value = u.lastname || '';
  document.getElementById('edit-user-phone').value = u.phone || '';
  document.getElementById('edit-user-role').value = u.role || 'cliente';
  document.getElementById('modal-edit-user').style.display = 'flex';
};

window.saveEditUser = async function() {
  const id = document.getElementById('edit-user-id').value;
  const data = {
    name: document.getElementById('edit-user-name').value,
    lastname: document.getElementById('edit-user-lastname').value,
    phone: document.getElementById('edit-user-phone').value,
    role: document.getElementById('edit-user-role').value,
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, 'users', id), data);
  closeModal('modal-edit-user');
  loadAllUsers();
};

window.deleteUser = async function(id) {
  if (!confirm('¿Eliminar este usuario? Sus citas no se eliminarán.')) return;
  await deleteDoc(doc(db, 'users', id));
  loadAllUsers();
};

// ============================================================
// ADMIN - CREAR CITA MANUAL
// ============================================================
window.handleAdminBooking = async function() {
  const clientEmail = document.getElementById('admin-client-email').value.trim();
  const clientName = document.getElementById('admin-client-name').value.trim();
  const service = document.getElementById('admin-book-service').value;
  const date = document.getElementById('admin-book-date').value;
  const time = document.getElementById('admin-book-time').value;
  const note = document.getElementById('admin-book-note').value;
  const errEl = document.getElementById('admin-book-error');
  const sucEl = document.getElementById('admin-book-success');

  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (!clientEmail || !clientName || !service || !date || !time) {
    errEl.textContent = 'Completa todos los campos obligatorios.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const apptData = {
      userId: 'admin-created',
      userName: clientName,
      userEmail: clientEmail,
      userPhone: '',
      service, date, time, note,
      status: 'confirmada',
      createdBy: 'admin',
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'appointments'), apptData);

    sendEmail('cita_confirmada', {
      userEmail: clientEmail,
      userName: clientName,
      service, date, time,
      adminEmail: ADMIN_EMAIL
    });

    sucEl.textContent = `✅ Cita creada para ${clientName} — ${service} el ${formatDate(date)} a las ${time}`;
    sucEl.style.display = 'block';

    document.getElementById('admin-client-email').value = '';
    document.getElementById('admin-client-name').value = '';
    document.getElementById('admin-book-service').value = '';
    document.getElementById('admin-book-date').value = '';
    document.getElementById('admin-book-time').value = '';
    document.getElementById('admin-book-note').value = '';
  } catch (e) {
    errEl.textContent = 'Error al crear la cita.';
    errEl.style.display = 'block';
    console.error(e);
  }
};

// ============================================================
// // API EMAIL RESEND - para correos automáticos
// ============================================================
async function sendEmail(event, data) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event,
        ...data,
        timestamp: new Date().toISOString()
      })
    });

    const result = await res.json();

    console.log('EMAIL RESULT:', result);

    if (!res.ok) {
      throw new Error(result.error || 'Error enviando correo');
    }

  } catch (e) {
    console.error('ERROR EMAIL:', e);
  }
}
// ============================================================
// HELPERS
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d} ${months[parseInt(m)-1]} ${y}`;
}

function firebaseError(code) {
  const errors = {
    'auth/email-already-in-use': 'Este correo ya está registrado.',
    'auth/invalid-email': 'Correo electrónico inválido.',
    'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres).',
    'auth/user-not-found': 'No existe una cuenta con este correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  };
  return errors[code] || 'Ocurrió un error. Intenta de nuevo.';
}

// Set min date for booking inputs
function poblarSelects() {
  const selectsServicio = ['book-service', 'admin-book-service', 'edit-service'];
  const selectsHora     = ['book-time', 'admin-book-time', 'edit-time'];

  const opcionesServicio = SERVICIOS.map(s =>
    `<option value="${s.nombre}">${s.emoji} ${s.nombre} - $${s.precio.toLocaleString('es-CO')}</option>`
  ).join('');

  const opcionesHora = HORARIOS.map(h =>
    `<option value="${h}">${h}</option>`
  ).join('');

  selectsServicio.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">Selecciona un servicio</option>` + opcionesServicio;
  });

  selectsHora.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">Selecciona hora</option>` + opcionesHora;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  ['book-date', 'admin-book-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.min = today;
  });

  poblarSelects();
  // Tarjetas de servicios en el landing
const grid = document.getElementById('services-grid');
if (grid) {
  grid.innerHTML = SERVICIOS.map(s => `
    <div class="service-card">
      <div class="service-icon">${s.emoji}</div>
      <h3>${s.nombre}</h3>
      <span class="service-price">Desde $${s.precio.toLocaleString('es-CO')}</span>
    </div>
  `).join('');
}
});