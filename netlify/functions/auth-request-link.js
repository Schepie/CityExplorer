import { Resend } from 'resend';
import { generateMagicToken, isEmailBlocked } from './utils/auth.js';

export const handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: "Email is required" }) };
    }

    // Revocation Check
    if (isEmailBlocked(email)) {
      console.warn(`Link request denied for blocked user: ${email}`);
      return { statusCode: 403, body: JSON.stringify({ error: "Access Revoked" }) };
    }

    // 1. Generate Token
    const token = generateMagicToken(email);

    // 2. Construct Link
    const appUrl = process.env.APP_URL || 'http://localhost:5173'; // Matches development port
    const magicLink = `${appUrl}?token=${token}`;

    // 3. Send Email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    const adminEmail = 'geert.schepers@gmail.com';

    await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `Login Link for ${email}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Login Request for CityExplorer</h2>
          <p><strong>User Email:</strong> ${email}</p>
          <p>Forward the link below to the user. This link expires in 15 minutes.</p>
          <p><a href="${magicLink}">${magicLink}</a></p>
        </div>
      `
    });

    console.log(`Relay link for ${email} sent to admin`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Relay sent to ${adminEmail}`, success: true })
    };

  } catch (error) {
    console.error("Auth Request Failed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send link" })
    };
  }
};
