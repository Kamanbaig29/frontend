import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error('RESEND_API_KEY is not set in your .env file.');
}

const resend = new Resend(resendApiKey);

// A simple utility function to send emails
const sendEmail = async (to: string, subject: string, htmlContent: string) => {
  try {
    await resend.emails.send({
      // IMPORTANT: For the free plan, Resend often requires using this 'from' address.
      // You can later verify your own domain (e.g., 'noreply@your-app.com') in the Resend dashboard.
      from: 'onboarding@resend.dev', 
      to: to,
      subject: subject,
      html: `<div>${htmlContent}</div>`, // Wrapping in a div is good practice
    });

    console.log(`Email sent to ${to}`);
    return true;
  // amazonq-ignore-next-line
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

export default sendEmail;
