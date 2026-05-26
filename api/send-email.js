// ============================================================
// VERCEL FUNCTION - Envío de correos con Resend
// PAB Peluquería
// ============================================================
// Este archivo corre en el servidor de Vercel (no en el navegador).
// Recibe una petición POST desde app.js con el tipo de evento
// y los datos necesarios, y envía el correo correspondiente.
// ============================================================

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY); // La API key está en Vercel como variable de entorno, no en el código
const ADMIN_EMAIL = 'izplopz@gmail.com'; // Correo del administrador

module.exports = async (req, res) => {

  // CORS: permite que el navegador haga peticiones a esta función
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS es una petición previa que hace el navegador antes del POST real
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Solo aceptamos POST, cualquier otro método se rechaza
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Extraemos los datos que llegaron desde app.js
  const { event, userName, userEmail, userPhone, service, date, time, note } = req.body;

  try {

    // ===== NUEVO USUARIO REGISTRADO =====
    // Se dispara cuando alguien se registra en la app
    // Solo se le avisa al admin — 1 correo
    if (event === 'nuevo_usuario') {
      await resend.emails.send({
        from: 'PAB Peluquería <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `👤 Nuevo usuario registrado — ${userName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #6B4226; padding: 30px; text-align: center;">
              <h1 style="color: #FDF6EE; margin: 0;">PAB Peluquería</h1>
              <p style="color: #C8922A; margin: 5px 0;">Panel Administrador</p>
            </div>
            <div style="padding: 30px; background: #FDF6EE;">
              <h2 style="color: #6B4226;">👤 Nuevo usuario registrado</h2>
              <div style="background: white; border-left: 4px solid #C8922A; padding: 20px; border-radius: 8px;">
                <p style="margin: 8px 0;"><strong>Nombre:</strong> ${userName}</p>
                <p style="margin: 8px 0;"><strong>Correo:</strong> ${userEmail}</p>
                ${userPhone ? `<p style="margin: 8px 0;"><strong>Teléfono:</strong> ${userPhone}</p>` : ''}
              </div>
            </div>
            <div style="background: #6B4226; padding: 20px; text-align: center;">
              <p style="color: #F5E6D3; margin: 0; font-size: 0.9rem;">© 2025 PAB Peluquería — Cali, Colombia 🇨🇴</p>
            </div>
          </div>
        `
      });
    }

    // ===== NUEVA CITA AGENDADA =====
    // Se dispara cuando un cliente agenda una cita
    // Por ahora solo le llega al admin — cuando Resend tenga dominio
    // propio verificado, se activa el correo al cliente también
    else if (event === 'nueva_cita') {

      // Correo al cliente — INACTIVO hasta verificar dominio en Resend
      // Con dominio propio Resend permite enviar a cualquier correo,
      // por ahora solo permite enviar al correo del dueño de la cuenta
      /*
      await resend.emails.send({
        from: 'PAB Peluquería <onboarding@resend.dev>',
        to: userEmail,
        subject: '✂️ Tu cita en PAB Peluquería',
         html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #6B4226; padding: 30px; text-align: center;">
              <h1 style="color: #FDF6EE; margin: 0;">PAB Peluquería</h1>
              <p style="color: #C8922A; margin: 5px 0;">Tu belleza, nuestra pasión</p>
            </div>
            <div style="padding: 30px; background: #FDF6EE;">
              <h2 style="color: #6B4226;">Hola ${userName}! 👋</h2>
              <p>Tu cita ha sido <strong>agendada exitosamente</strong>.</p>
              <div style="background: white; border-left: 4px solid #C8922A; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 8px 0;"><strong>✂️ Servicio:</strong> ${service}</p>
                <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${date}</p>
                <p style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${time}</p>
                ${note ? `<p style="margin: 8px 0;"><strong>📝 Nota:</strong> ${note}</p>` : ''}
              </div>
              <p style="color: #9B7355;">¡Te esperamos! Si necesitas cancelar o cambiar tu cita contáctanos.</p>
            </div>
            <div style="background: #6B4226; padding: 20px; text-align: center;">
              <p style="color: #F5E6D3; margin: 0; font-size: 0.9rem;">© 2025 PAB Peluquería — Cali, Colombia 🇨🇴</p>
            </div>
          </div>
        `
      });
      */

      // Correo al admin con los datos completos de la cita
      await resend.emails.send({
        from: 'PAB Peluquería <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `🔔 Nueva cita — ${userName} — ${service}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #6B4226; padding: 30px; text-align: center;">
              <h1 style="color: #FDF6EE; margin: 0;">PAB Peluquería</h1>
              <p style="color: #C8922A; margin: 5px 0;">Panel Administrador</p>
            </div>
            <div style="padding: 30px; background: #FDF6EE;">
              <h2 style="color: #6B4226;">🔔 Nueva cita agendada</h2>
              <div style="background: white; border-left: 4px solid #C8922A; padding: 20px; border-radius: 8px;">
                <p style="margin: 8px 0;"><strong>👤 Cliente:</strong> ${userName}</p>
                <p style="margin: 8px 0;"><strong>📧 Correo:</strong> ${userEmail}</p>
                <p style="margin: 8px 0;"><strong>✂️ Servicio:</strong> ${service}</p>
                <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${date}</p>
                <p style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${time}</p>
                ${note ? `<p style="margin: 8px 0;"><strong>📝 Nota:</strong> ${note}</p>` : ''}
              </div>
            </div>
            <div style="background: #6B4226; padding: 20px; text-align: center;">
              <p style="color: #F5E6D3; margin: 0; font-size: 0.9rem;">© 2025 PAB Peluquería</p>
            </div>
          </div>
        `
      });
    }

    // ===== CITA CONFIRMADA POR ADMIN =====
    // Se dispara cuando el admin confirma una cita desde el panel
    // Le notifica al cliente que su cita fue aprobada
    else if (event === 'cita_confirmada') {
      await resend.emails.send({
        from: 'PAB Peluquería <onboarding@resend.dev>',
        to: ADMIN_EMAIL, // cambiar a userEmail cuando Resend esté verificado
        subject: '✅ Tu cita fue confirmada — PAB Peluquería',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #6B4226; padding: 30px; text-align: center;">
              <h1 style="color: #FDF6EE; margin: 0;">PAB Peluquería</h1>
              <p style="color: #C8922A; margin: 5px 0;">Tu belleza, nuestra pasión</p>
            </div>
            <div style="padding: 30px; background: #FDF6EE;">
              <h2 style="color: #6B4226;">Hola ${userName}! ✅</h2>
              <p>Tu cita ha sido <strong>confirmada</strong> por nuestro equipo.</p>
              <div style="background: white; border-left: 4px solid #C8922A; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 8px 0;"><strong>✂️ Servicio:</strong> ${service}</p>
                <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${date}</p>
                <p style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${time}</p>
              </div>
              <p style="color: #9B7355;">¡Te esperamos! Si necesitas cancelar contáctanos.</p>
            </div>
            <div style="background: #6B4226; padding: 20px; text-align: center;">
              <p style="color: #F5E6D3; margin: 0; font-size: 0.9rem;">© 2025 PAB Peluquería — Cali, Colombia 🇨🇴</p>
            </div>
          </div>
        `
      });
    }

    // Responde al navegador que todo salió bien
    return res.status(200).json({ success: true });

  } catch (error) {
    // Si algo falla, lo muestra en los logs de Vercel y responde con error
    console.error('Error enviando correo:', error);
    return res.status(500).json({ error: 'Error al enviar correo' });
  }
};