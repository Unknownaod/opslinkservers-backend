const verifyURL = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

await sendEmail({
  to: email,
  subject: 'Verify Your OpsLink Account',
  html: `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
    
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="https://cdn.discordapp.com/attachments/1463619235904229378/1466802083834368184/FuwELkz.png?ex=69889d64&is=69874be4&hm=d91b7dc2a57a579671ead07b48c9dcf31f17984940c54ac8029b4bf571283396&" 
           alt="OpsLink Logo" 
           style="width: 120px;">
    </div>
    
    <!-- Heading -->
    <h2 style="color: #111827; text-align: center;">Welcome to OpsLink Servers!</h2>
    
    <!-- Message -->
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
      Thank you for signing up! To activate your account and start using OpsLink, please verify your email by clicking the button below:
    </p>
    
    <!-- Verification Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyURL}" 
         style="padding: 14px 25px; background-color: #4f46e5; color: white; text-decoration: none; font-weight: 600; border-radius: 8px; display: inline-block;">
        Verify Email
      </a>
    </div>
    
    <!-- Disclaimer -->
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
      If you did not create this account, you can safely ignore this email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <!-- Footer -->
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      OpsLink Servers<br>
      &copy; ${new Date().getFullYear()} OpsLink Systems. All rights reserved.
    </p>
  </div>
  `
});
