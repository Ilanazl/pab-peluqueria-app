// ============================================================
// VERCEL FUNCTION - Envío de correos con Resend
// PAB Peluquería
// ============================================================

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = 'izplopz@gmail.com';

module.exports = async (req, res) => {
  // Headers CORS - necesarios para que el navegador permita la llamada
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo acepta peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { event, userName, userEmail, service, date, time, note } = req.body;

  try {
    // ===== CORREO AL CLIENTE =====
    await resend.emails.send({
      from: 'PAB Peluquería <onboarding@resend.dev>',
      to: 'izplopz@gmail.com',
      subject: '✂️ Tu cita en PAB Peluquería',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #6B4226; padding: 30px; text-align: center;">
            <h1 style="color: #FDF6EE; margin: 0;">PAB Peluquería</h1>
            <p style="color: #C8922A; margin: 5px 0;">Tu belleza, nuestra pasión</p>
          </div>
          <div style="padding: 30px; background: #FDF6EE;">
            <h2 style="color: #6B4226;">Hola ${userName}! 👋</h2>
            <p style="color: #5C3D2E;">
              ${event === 'nueva_cita' 
                ? 'Tu cita ha sido <strong>agendada exitosamente</strong>.' 
                : 'Tu cita ha sido <strong>confirmada</strong>.'}
            </p>
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

    // ===== CORREO AL ADMIN =====
    await resend.emails.send({
      from: 'PAB Peluquería <onboarding@resend.dev>',
      to: 'izplopz@gmail.com',
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

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error enviando correo:', error);
    return res.status(500).json({ error: 'Error al enviar correo' });
  }
};
