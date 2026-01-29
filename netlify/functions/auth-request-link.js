import { Resend } from 'resend';
import { generateMagicToken, isEmailBlocked, generateAccessCode } from './utils/auth.js';

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

    // 1. Generate Token & Access Code
    const token = generateMagicToken(email);
    const accessCode = generateAccessCode(email);

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
      subject: `Access Credentials for ${email}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0f172a;">Login Request for CityExplorer</h2>
          <p><strong>User Email:</strong> ${email}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
          
          <h3 style="color: #334155;">Option 1: Magic Link</h3>
          <p>Forward the link below to the user. This link expires in 15 minutes.</p>
          <p style="word-break: break-all;"><a href="${magicLink}">${magicLink}</a></p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
          
          <h3 style="color: #334155;">Option 2: Access Code</h3>
          <p>Alternatively, the user can enter this 6-digit code in the app:</p>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; display: inline-block;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #2563eb; font-family: monospace;">${accessCode}</span>
          </div>
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
