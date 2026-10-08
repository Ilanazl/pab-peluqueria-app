// ============================================================
// APP.JS - PAB PELUQUERÍA - Lógica principal
// ============================================================

import {
  auth, db, ADMIN_EMAIL,
  GOOGLE_HOLIDAYS_CALENDAR_ID, GOOGLE_CLOSURES_CALENDAR_ID,
  GOOGLE_CALENDAR_API_KEY
} from "./firebase-config.js";
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
let businessClosuresCache = null;
let businessClosuresCacheTime = 0;
const googleClosuresByYear = new Map();

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
  if (tabId === 'admin-tab-reports') loadReports();
  if (tabId === 'admin-tab-dashboard') loadDashboard();
  if (tabId === 'admin-tab-closures') loadBusinessClosuresAdmin();
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
        loadDashboard();
      } else {
        document.getElementById('user-greeting').textContent = `Hola, ${currentUserData.name}!`;
        showPage('page-dashboard');
        loadLoyaltyStatus();
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

// Validar aceptación de términos
  const terms = document.getElementById('reg-terms');
  if (!terms.checked) {
    errEl.textContent = 'Debes aceptar el tratamiento de datos personales para registrarte.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const role = email === ADMIN_EMAIL ? 'admin' : 'cliente';

    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      name, lastname, email, phone, role,
      createdAt: serverTimestamp(),

      consentimiento: {
    aceptado: true,
    fecha: serverTimestamp(),       
    version: 'v1.0',              
    metodo: 'checkbox-registro'     
  }
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
// ELIMINAR CUENTA (CLIENTE)
// ============================================================
window.handleDeleteAccount = async function() {
  const confirm1 = confirm(
    '¿Estás seguro que deseas eliminar tu cuenta?\n\n' +
    'Tu cuenta y datos personales serán eliminados de inmediato. ' +
    'Tu historial de citas será eliminado en 15 días hábiles.'
  );
  if (!confirm1) return;

  const confirm2 = confirm(
    'Esta acción es IRREVERSIBLE.\n\n' +
    '¿Confirmas que deseas eliminar tu cuenta definitivamente?'
  );
  if (!confirm2) return;

  try {
    const uid = currentUser.uid;

    // 1. Marcar citas para eliminación en 15 días
    const citasSnap = await getDocs(query(
      collection(db, 'appointments'),
      where('userId', '==', uid)
    ));

    const batch = [];
    citasSnap.forEach(citaDoc => {
      const fechaEliminacion = new Date();
      fechaEliminacion.setDate(fechaEliminacion.getDate() + 15);
      batch.push(updateDoc(doc(db, 'appointments', citaDoc.id), {
        eliminacionPendiente: true,
        fechaEliminacion: fechaEliminacion.toISOString(),
        usuarioEliminado: uid
      }));
    });
    await Promise.all(batch);

    // 2. Eliminar documento del usuario en Firestore
    await deleteDoc(doc(db, 'users', uid));

    // 3. Eliminar cuenta en Firebase Authentication
    await currentUser.delete();

    // 4. Redirigir al landing
    alert('Tu cuenta ha sido eliminada. Tu historial de citas será eliminado en 15 días hábiles.');
    showPage('page-landing');

  } catch (e) {
    // Firebase requiere que el login sea reciente para eliminar la cuenta
    if (e.code === 'auth/requires-recent-login') {
      alert(
        'Por seguridad, debes iniciar sesión nuevamente antes de eliminar tu cuenta.\n\n' +
        'Cierra sesión, vuelve a iniciar sesión y repite el proceso.'
      );
    } else {
      alert('Error al eliminar la cuenta. Intenta de nuevo.');
      console.error(e);
    }
  }
};

// ============================================================
// AGENDAR CITA (CLIENTE)
// ============================================================
async function getBusinessClosures() {
  const now = Date.now();
  if (businessClosuresCache && now - businessClosuresCacheTime < 5 * 60 * 1000) {
    return businessClosuresCache;
  }
  const snapshot = await getDocs(collection(db, 'businessClosures'));
  businessClosuresCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  businessClosuresCacheTime = now;
  return businessClosuresCache;
}

async function getGoogleClosures(year) {
  if (!GOOGLE_CALENDAR_API_KEY) return [];
  if (googleClosuresByYear.has(year)) return googleClosuresByYear.get(year);
  const events = [];
  const calendarIds = [...new Set([
    GOOGLE_HOLIDAYS_CALENDAR_ID,
    GOOGLE_CLOSURES_CALENDAR_ID
  ].filter(Boolean))];

  for (const calendarId of calendarIds) {
    const params = new URLSearchParams({
      key: GOOGLE_CALENDAR_API_KEY,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
      timeMin: `${year}-01-01T00:00:00-05:00`,
      timeMax: `${year + 1}-01-01T00:00:00-05:00`
    });
    let pageToken = '';
    do {
      if (pageToken) params.set('pageToken', pageToken);
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Google Calendar respondió ${response.status}`);
      const result = await response.json();
      events.push(...(result.items || []));
      pageToken = result.nextPageToken || '';
    } while (pageToken);
  }

  const holidayDates = events.map(event => ({
    date: event.start?.date || event.start?.dateTime?.slice(0, 10),
    reason: event.summary || 'Cierre registrado en Google Calendar'
  })).filter(event => event.date);
  googleClosuresByYear.set(year, holidayDates);
  return holidayDates;
}

async function getUnavailableDateReason(date) {
  if (!date) return null;
  const localDate = new Date(`${date}T12:00:00`);
  if (localDate.getDay() === 0) return 'No hay servicio los domingos.';

  const closures = await getBusinessClosures();
  const manualClosure = closures.find(closure => closure.date === date);
  if (manualClosure) return manualClosure.reason || 'No hay servicio en la fecha seleccionada.';

  try {
    const googleClosure = (await getGoogleClosures(localDate.getFullYear()))
      .find(event => event.date === date);
    if (googleClosure) return googleClosure.reason || 'No hay servicio en esta fecha.';
  } catch (error) {
    console.error('No se pudo consultar Google Calendar:', error);
    return 'No pudimos verificar el calendario de festivos. Intenta de nuevo antes de agendar.';
  }
  return null;
}

window.checkBookingDate = async function(inputId) {
  const input = document.getElementById(inputId);
  const message = document.getElementById(`${inputId}-availability`);
  if (!input) return;
  input.setCustomValidity('');
  if (message) {
    message.textContent = '';
    message.style.display = 'none';
  }
  if (!input.value) return;

  try {
    const reason = await getUnavailableDateReason(input.value);
    if (reason) {
      input.setCustomValidity(reason);
      if (message) {
        message.textContent = reason;
        message.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('No se pudo validar el día seleccionado:', error);
    const reason = 'No se pudo verificar la disponibilidad. Intenta de nuevo.';
    input.setCustomValidity(reason);
    if (message) {
      message.textContent = reason;
      message.style.display = 'block';
    }
  }
};

window.loadBusinessClosuresAdmin = async function() {
  const list = document.getElementById('business-closures-list');
  const connection = document.getElementById('google-calendar-connection');
  if (!list) return;
  if (connection) {
    connection.innerHTML = GOOGLE_CALENDAR_API_KEY
      ? `<span class="calendar-connection-ok">Lectura de festivos activada</span><p>Google Calendar: ${escapeHtml(GOOGLE_HOLIDAYS_CALENDAR_ID)}${GOOGLE_CLOSURES_CALENDAR_ID ? `<br>Cierres adicionales: ${escapeHtml(GOOGLE_CLOSURES_CALENDAR_ID)}` : ''}</p>`
      : '<span class="calendar-connection-pending">Festivos de Google pendientes de activar</span><p>El calendario de festivos de Colombia ya está configurado. Agrega una clave de Google Calendar API en firebase-config.js para activarlo. Los cierres manuales de PAB funcionan mientras tanto.</p>';
  }
  list.innerHTML = '<div class="loading">Cargando cierres...</div>';
  try {
    const closures = await getBusinessClosures();
    closures.sort((a, b) => a.date.localeCompare(b.date));
    list.innerHTML = closures.length
      ? closures.map(closure => `<div class="closure-row"><div><strong>${formatDate(closure.date)}</strong><p>${escapeHtml(closure.reason || 'Día sin servicio')}</p></div><button class="btn-danger btn-sm" onclick="deleteBusinessClosure('${escapeHtml(closure.id)}')">Eliminar</button></div>`).join('')
      : '<div class="empty-state"><p>No hay cierres manuales registrados.</p></div>';
  } catch (error) {
    list.innerHTML = '<div class="loading">No se pudieron cargar los cierres.</div>';
    console.error(error);
  }
};

window.saveBusinessClosure = async function() {
  const dateInput = document.getElementById('closure-date');
  const reasonInput = document.getElementById('closure-reason');
  const message = document.getElementById('closure-message');
  const date = dateInput.value;
  const reason = reasonInput.value.trim();
  message.style.display = 'none';
  if (!date || !reason) {
    message.textContent = 'Indica la fecha y el motivo del cierre.';
    message.className = 'error-msg';
    message.style.display = 'block';
    return;
  }
  if (new Date(`${date}T12:00:00`).getDay() === 0) {
    message.textContent = 'Los domingos ya se bloquean automáticamente.';
    message.className = 'error-msg';
    message.style.display = 'block';
    return;
  }
  try {
    await setDoc(doc(db, 'businessClosures', date), {
      date,
      reason,
      source: 'admin',
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    });
    businessClosuresCache = null;
    dateInput.value = '';
    reasonInput.value = '';
    message.textContent = 'Cierre guardado. Esa fecha ya no estará disponible para reservar.';
    message.className = 'success-msg';
    message.style.display = 'block';
    await loadBusinessClosuresAdmin();
  } catch (error) {
    console.error(error);
    message.textContent = 'No se pudo guardar. Verifica las reglas de Firestore para businessClosures.';
    message.className = 'error-msg';
    message.style.display = 'block';
  }
};

window.deleteBusinessClosure = async function(date) {
  if (!confirm(`¿Eliminar el cierre del ${formatDate(date)}?`)) return;
  try {
    await deleteDoc(doc(db, 'businessClosures', date));
    businessClosuresCache = null;
    await loadBusinessClosuresAdmin();
  } catch (error) {
    console.error(error);
    alert('No se pudo eliminar el cierre. Verifica las reglas de Firestore.');
  }
};

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

  let unavailableReason;
  try {
    unavailableReason = await getUnavailableDateReason(date);
  } catch (error) {
    console.error('No se pudo comprobar el cierre de la fecha:', error);
    errEl.textContent = 'No pudimos validar si ese día está disponible. Intenta de nuevo.';
    errEl.style.display = 'block';
    return;
  }
  if (unavailableReason) {
    errEl.textContent = unavailableReason;
    errEl.style.display = 'block';
    return;
  }

 try {
  // Verificar disponibilidad consultando UN SOLO documento por ID (no una lista con filtros)
  const slotId = `${date}_${time}`;
  const slotRef = doc(db, 'occupiedSlots', slotId);
  const slotSnap = await getDoc(slotRef);

  if (slotSnap.exists()) {
    errEl.textContent = '⚠️ Esa hora ya está reservada. Por favor elige otra hora.';
    errEl.style.display = 'block';
    return;
  }

  const usarRecompensa = document.getElementById('book-use-reward')?.checked || false;

    const apptData = {
      userId: currentUser.uid,
      userName: `${currentUserData.name} ${currentUserData.lastname}`,
      userEmail: currentUser.email,
      userPhone: currentUserData.phone || '',
      service, date, time, note,
      status: 'confirmada',
      slotId, 
      esRecompensa: usarRecompensa,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'appointments'), apptData);

     // Marcar el horario como ocupado (documento sin datos personales)
    await setDoc(slotRef, { date, time, occupied: true });

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
          ${a.esRecompensa ? `<span class="status-badge reward-badge">🎁 Corte gratis</span>` : ''}
        </div>
        <div class="appt-actions">
        ${a.status !== 'cancelada' ? `<button class="btn-danger" onclick="cancelUserAppointment('${a.id}')">Cancelar</button>` : ''}
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
  try {
    // Primero leemos la cita para saber qué slot le corresponde
    const apptRef = doc(db, 'appointments', id);
    const apptSnap = await getDoc(apptRef);
    if (!apptSnap.exists()) return;
    const apptData = apptSnap.data();

    // Marcamos la cita como cancelada
    await updateDoc(apptRef, { status: 'cancelada' });

    // Liberamos el horario para que otros clientes puedan agendarlo
    if (apptData.slotId) {
      await deleteDoc(doc(db, 'occupiedSlots', apptData.slotId));
    }

    loadUserAppointments();
  } catch (e) {
    console.error(e);
    alert('Error al cancelar la cita. Intenta de nuevo.');
  }
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
        ${a.esRecompensa ? `<span class="status-badge reward-badge">🎁 Corte gratis</span>` : ''}
      </div>
      <div class="appt-actions">
        <button class="btn-edit" onclick="openEditAppointment('${a.id}')">✏️ Editar</button>
        ${a.status === 'pendiente' ? `<button class="btn-confirm" onclick="confirmAppointment('${a.id}', '${a.userEmail}', '${a.userName}', '${a.service}', '${a.date}', '${a.time}')">✓ Confirmar</button>` : ''}
        ${a.status === 'confirmada' ? `<button class="btn-confirm" onclick="markAppointmentCompleted('${a.id}')">✓ Completada</button>` : ''}
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
  const apptRef = doc(db, 'appointments', id);

  try {
    const apptSnap = await getDoc(apptRef);
    if (!apptSnap.exists()) return;
    const oldData = apptSnap.data();

    const newDate = document.getElementById('edit-date').value;
    const newTime = document.getElementById('edit-time').value;
    const newStatus = document.getElementById('edit-status').value;
    const newSlotId = `${newDate}_${newTime}`;
    // Si la cita vieja no tenía slotId guardado (citas creadas antes de este cambio),
    // lo reconstruimos con su fecha/hora anterior
    const oldSlotId = oldData.slotId || `${oldData.date}_${oldData.time}`;

    const data = {
      service: document.getElementById('edit-service').value,
      date: newDate,
      time: newTime,
      status: newStatus,
      note: document.getElementById('edit-note').value,
      slotId: newSlotId,
      updatedAt: serverTimestamp()
    };

    await updateDoc(apptRef, data);

    const wasCancelada = oldData.status === 'cancelada';
    const esCancelada = newStatus === 'cancelada';
    const cambioHorario = oldData.date !== newDate || oldData.time !== newTime;

    if (esCancelada && !wasCancelada) {
      // Se canceló ahora: liberar el horario viejo
      await deleteDoc(doc(db, 'occupiedSlots', oldSlotId)).catch(() => {});
    } else if (!esCancelada && wasCancelada) {
      // Se reactivó: ocupar el horario nuevo
      await setDoc(doc(db, 'occupiedSlots', newSlotId), { date: newDate, time: newTime, occupied: true });
    } else if (!esCancelada && cambioHorario) {
      // Se movió de horario sin cancelar: liberar el viejo, ocupar el nuevo
      await deleteDoc(doc(db, 'occupiedSlots', oldSlotId)).catch(() => {});
      await setDoc(doc(db, 'occupiedSlots', newSlotId), { date: newDate, time: newTime, occupied: true });
    }
    // Si no cambió ni el estado ni el horario, no tocamos occupiedSlots

  } catch (e) {
    console.error(e);
    alert('Error al guardar los cambios.');
  }

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

window.markAppointmentCompleted = async function(id) {
  if (!confirm('¿Confirmas que el cliente ya recibió el servicio?')) return;

  try {
    const apptRef = doc(db, 'appointments', id);
    const apptSnap = await getDoc(apptRef);
    if (!apptSnap.exists()) return;
    const appt = apptSnap.data();

    await updateDoc(apptRef, { status: 'completada' });

    // Citas creadas manualmente por el admin (sin cuenta de cliente) no participan en fidelidad
    if (appt.userId === 'admin-created') {
      loadAllAppointments();
      return;
    }

    const userRef = doc(db, 'users', appt.userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) { loadAllAppointments(); return; }
    const userData = userSnap.data();

    if (appt.esRecompensa) {
      // Esta era la cita gratis: se cerró el ciclo, se apaga la recompensa
      await updateDoc(userRef, { recompensaDisponible: false });
    } else {
      const nuevoConteo = (userData.cortesCompletados || 0) + 1;
      if (nuevoConteo >= 6) {
        await updateDoc(userRef, { cortesCompletados: 0, recompensaDisponible: true });
      } else {
        await updateDoc(userRef, { cortesCompletados: nuevoConteo });
      }
    }

    loadAllAppointments();
  } catch (e) {
    console.error(e);
    alert('Error al marcar la cita como completada.');
  }
};

window.deleteAppointment = async function(id) {
  if (!confirm('¿Eliminar esta cita permanentemente?')) return;
  await deleteDoc(doc(db, 'appointments', id));
  loadAllAppointments();
};

// ============================================================
//INFORME MENSUAL
// ============================================================

function startOfWeek(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

window.loadDashboard = async function() {
  const container = document.getElementById('dashboard-content');
  if (!container) return;
  container.innerHTML = '<div class="loading">Cargando dashboard...</div>';

  try {
    const snapshot = await getDocs(collection(db, 'appointments'));
    const citas = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(cita => cita.date);

    const selector = document.getElementById('dashboard-week');
    if (!selector.value) selector.value = dateKey(new Date());

    const inicioSemana = startOfWeek(new Date(`${selector.value}T12:00:00`));
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(finSemana.getDate() + 6);
    const inicio = dateKey(inicioSemana);
    const fin = dateKey(finSemana);
    const citasSemana = citas.filter(cita => cita.date >= inicio && cita.date <= fin);
    const completadas = citasSemana.filter(cita => cita.status === 'completada');
    const agendadas = citasSemana.filter(cita => cita.status === 'pendiente');
    const confirmadas = citasSemana.filter(cita => cita.status === 'confirmada');
    const todasCompletadas = citas.filter(cita => cita.status === 'completada');

    const semanas = Array.from({ length: 6 }, (_, index) => {
      const semanaInicio = new Date(inicioSemana);
      semanaInicio.setDate(semanaInicio.getDate() - (5 - index) * 7);
      const semanaFin = new Date(semanaInicio);
      semanaFin.setDate(semanaFin.getDate() + 6);
      const llave = dateKey(semanaInicio);
      const total = todasCompletadas.filter(
        cita => cita.date >= llave && cita.date <= dateKey(semanaFin)
      ).length;
      return { llave, inicio: semanaInicio, total };
    });

    const maximo = Math.max(1, ...semanas.map(semana => semana.total));
    const ingresos = completadas.reduce(
      (total, cita) => total + (cita.esRecompensa ? 0 : getPrecioServicio(cita.service)),
      0
    );
    const cortesGratis = completadas.filter(cita => cita.esRecompensa).length;
    const servicios = Object.entries(completadas.reduce((conteo, cita) => {
      const nombre = cita.service || 'Servicio';
      conteo[nombre] = (conteo[nombre] || 0) + 1;
      return conteo;
    }, {})).sort((a, b) => b[1] - a[1]);

    const renderDashboard = (estadoFiltro = 'todos', servicioFiltro = 'todos') => {
      const citasFiltradas = citasSemana.filter(cita =>
        (estadoFiltro === 'todos' || cita.status === estadoFiltro) &&
        (servicioFiltro === 'todos' || cita.service === servicioFiltro)
      );
      const nombresEstado = {
        pendiente: 'Agendada',
        confirmada: 'Confirmada',
        completada: 'Completada',
        cancelada: 'Cancelada'
      };

      container.innerHTML = `
        <div class="dashboard-stats">
          <article class="dashboard-stat"><span class="stat-icon">📅</span><span class="stat-label">Citas agendadas</span><strong>${agendadas.length}</strong><small>Esperando confirmación</small></article>
          <article class="dashboard-stat"><span class="stat-icon">✅</span><span class="stat-label">Citas confirmadas</span><strong>${confirmadas.length}</strong><small>En la semana seleccionada</small></article>
          <article class="dashboard-stat"><span class="stat-icon">✂</span><span class="stat-label">Citas realizadas</span><strong>${completadas.length}</strong><small>${cortesGratis} corte(s) gratis de fidelidad</small></article>
          <article class="dashboard-stat"><span class="stat-icon">💰</span><span class="stat-label">Ingresos realizados</span><strong>$${ingresos.toLocaleString('es-CO')}</strong><small>Según tarifa del servicio</small></article>
        </div>

        <section class="dashboard-panel">
          <div class="dashboard-panel-heading"><div><h3>Actividad semanal</h3><p>Citas completadas por semana · últimas 6 semanas</p></div><span class="dashboard-period">${formatDate(inicio)} — ${formatDate(fin)}</span></div>
          <div class="weekly-chart" role="img" aria-label="Citas completadas por semana">
            ${semanas.map(semana => `<div class="chart-column"><span class="chart-value">${semana.total}</span><div class="chart-track"><div class="chart-bar ${semana.llave === inicio ? 'chart-bar-active' : ''}" style="height:${Math.max(semana.total ? 12 : 4, semana.total / maximo * 100)}%"></div></div><span class="chart-label">${semana.inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span></div>`).join('')}
          </div>
        </section>

        <section class="dashboard-panel">
          <div class="dashboard-panel-heading"><div><h3>Servicios completados</h3><p>Distribución de cortes y servicios realizados</p></div></div>
          ${servicios.length
            ? `<div class="service-breakdown">${servicios.map(([nombre, cantidad]) => `<div class="service-row"><span>${escapeHtml(nombre)}</span><div class="service-track"><div style="width:${cantidad / completadas.length * 100}%"></div></div><strong>${cantidad}</strong></div>`).join('')}</div>`
            : '<p class="dashboard-empty-inline">Todavía no hay servicios completados en esta semana.</p>'}
        </section>

        <section class="dashboard-panel dashboard-table-panel">
          <div class="dashboard-panel-heading"><div><h3>Citas de la semana</h3><p id="dashboard-results-count">${citasFiltradas.length} cita(s)</p></div></div>
          <div class="dashboard-filters">
            <label>Estado<select id="dashboard-status-filter">
              <option value="todos" ${estadoFiltro === 'todos' ? 'selected' : ''}>Todos los estados</option>
              <option value="pendiente" ${estadoFiltro === 'pendiente' ? 'selected' : ''}>Agendadas</option>
              <option value="confirmada" ${estadoFiltro === 'confirmada' ? 'selected' : ''}>Confirmadas</option>
              <option value="completada" ${estadoFiltro === 'completada' ? 'selected' : ''}>Completadas</option>
              <option value="cancelada" ${estadoFiltro === 'cancelada' ? 'selected' : ''}>Canceladas</option>
            </select></label>
            <label>Servicio<select id="dashboard-service-filter">
              <option value="todos">Todos los servicios</option>
              ${[...new Set(citasSemana.map(cita => cita.service).filter(Boolean))].map(servicio => `<option value="${escapeHtml(servicio)}" ${servicioFiltro === servicio ? 'selected' : ''}>${escapeHtml(servicio)}</option>`).join('')}
            </select></label>
            <button type="button" class="btn-ghost btn-sm" id="dashboard-reset-filters">Limpiar filtros</button>
          </div>
          <div id="dashboard-table-results">
            ${citasFiltradas.length
              ? `<div class="dashboard-table-wrap"><table class="dashboard-table"><thead><tr><th>Fecha y hora</th><th>Cliente</th><th>Servicio</th><th>Valor</th><th>Estado</th></tr></thead><tbody>${citasFiltradas.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.time || '').localeCompare(String(b.time || ''))).map(cita => `<tr><td><strong>${formatDate(cita.date)}</strong><small>${escapeHtml(cita.time || '—')}</small></td><td><strong>${escapeHtml(cita.userName || 'Cliente')}</strong><small>${escapeHtml(cita.userEmail || '')}</small></td><td>${escapeHtml(cita.service || 'Servicio')}</td><td>${cita.esRecompensa ? 'Gratis' : `$${getPrecioServicio(cita.service).toLocaleString('es-CO')}`}</td><td><span class="dashboard-status dashboard-status-${escapeHtml(cita.status || '')}">${nombresEstado[cita.status] || escapeHtml(cita.status || 'Sin estado')}</span></td></tr>`).join('')}</tbody></table></div>`
              : '<div class="empty-state"><p>No hay citas con estos filtros.</p></div>'}
          </div>
        </section>`;

      const estadoSelect = document.getElementById('dashboard-status-filter');
      const servicioSelect = document.getElementById('dashboard-service-filter');
      estadoSelect.addEventListener('change', () => renderDashboard(estadoSelect.value, servicioSelect.value));
      servicioSelect.addEventListener('change', () => renderDashboard(estadoSelect.value, servicioSelect.value));
      document.getElementById('dashboard-reset-filters').addEventListener('click', () => renderDashboard());
    };

    renderDashboard();
  } catch (error) {
    container.innerHTML = '<div class="loading">No se pudo cargar el dashboard. Intenta actualizarlo.</div>';
    console.error('Error al cargar dashboard:', error);
  }
};

function getPrecioServicio(nombreServicio) {
  const servicio = SERVICIOS.find(s => s.nombre === nombreServicio);
  return servicio ? servicio.precio : 0;
}

window.loadReports = async function() {
  const container = document.getElementById('reports-content');
  container.innerHTML = '<div class="loading">Generando informe...</div>';

  try {
    const snap = await getDocs(collection(db, 'appointments'));
    const appts = snap.docs.map(d => d.data());
    const completadas = appts.filter(a => a.status === 'completada');

    // Agrupar por mes usando "YYYY-MM" como llave (los primeros 7 caracteres de la fecha)
    const porMes = {};
    completadas.forEach(a => {
      const mes = a.date.slice(0, 7);
      if (!porMes[mes]) porMes[mes] = { cortes: 0, ingresos: 0, gratis: 0 };

      porMes[mes].cortes++;
      if (a.esRecompensa) {
        porMes[mes].gratis++;
      } else {
        porMes[mes].ingresos += getPrecioServicio(a.service);
      }
    });

    const meses = Object.keys(porMes).sort().reverse(); // más reciente primero

    if (meses.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">📊</div><p>Aún no hay citas completadas para generar informes.</p></div>`;
      return;
    }

    const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    container.innerHTML = meses.map(mes => {
      const data = porMes[mes];
      const [anio, mesNum] = mes.split('-');
      return `
        <div class="report-card">
          <h3>${nombresMes[parseInt(mesNum) - 1]} ${anio}</h3>
          <div class="report-stats">
            <div class="report-stat">
              <span class="report-number">${data.cortes}</span>
              <span class="report-label">Cortes realizados</span>
            </div>
            <div class="report-stat">
              <span class="report-number">$${data.ingresos.toLocaleString('es-CO')}</span>
              <span class="report-label">Ingresos</span>
            </div>
            <div class="report-stat">
              <span class="report-number">${data.gratis}</span>
              <span class="report-label">Cortes gratis (fidelidad)</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="loading">Error al generar el informe.</div>';
    console.error(e);
  }
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

     // Contar cuántas citas ha agendado cada usuario (todas, sin importar el estado)
    const apptsSnap = await getDocs(collection(db, 'appointments'));
    const conteoPorUsuario = {};
    apptsSnap.forEach(docSnap => {
      const uid = docSnap.data().userId;
      conteoPorUsuario[uid] = (conteoPorUsuario[uid] || 0) + 1;
    });

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
          <p>Citas agendadas: ${conteoPorUsuario[u.id] || 0}</p>
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

  let unavailableReason;
  try {
    unavailableReason = await getUnavailableDateReason(date);
  } catch (error) {
    console.error('No se pudo comprobar el cierre de la fecha:', error);
    errEl.textContent = 'No pudimos validar si ese día está disponible. Intenta de nuevo.';
    errEl.style.display = 'block';
    return;
  }
  if (unavailableReason) {
    errEl.textContent = unavailableReason;
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

async function loadLoyaltyStatus() {
  const badge = document.getElementById('loyalty-badge');
  if (!badge || !currentUserData) return;

  const conteo = currentUserData.cortesCompletados || 0;
  const disponible = currentUserData.recompensaDisponible || false;

  if (disponible) {
    badge.innerHTML = `🎁 <strong>¡Tienes un corte gratis disponible!</strong> Selecciónalo al agendar tu próxima cita.`;
    badge.classList.add('reward-ready');
  } else {
    const faltan = 6 - conteo;
    badge.innerHTML = `✂️ Te faltan <strong>${faltan}</strong> corte${faltan === 1 ? '' : 's'} para tu sexto corte gratis (${conteo}/6)`;
    badge.classList.remove('reward-ready');
  }

  document.getElementById('reward-checkbox-group').style.display = disponible ? 'block' : 'none';
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
  const today = dateKey(new Date());
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
