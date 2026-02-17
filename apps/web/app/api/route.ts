import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email, name } = await req.json();

  await resend.emails.send({
    from: "CampChat <hello@campchat.app>",
    to: email,
    subject: "You're on the waitlist! ⛺",
    html: `
      <div style="background:#000; color:#fff; font-family:sans-serif; padding:40px; max-width:500px; margin:0 auto; border-radius:16px;">
        <img src="https://campchat.app/logo.png" width="60" style="margin-bottom:20px;" />
        <h1 style="color:#fff; margin-bottom:8px;">You're in, ${name || "friend"}! 🎉</h1>
        <p style="color:#aaa;">You're on the CampChat waitlist. We'll hit you up the moment we launch at your campus.</p>
        <p style="color:#aaa; margin-top:24px;">Stay tuned,<br/><strong style="color:#fff;">The CampChat Team</strong></p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}