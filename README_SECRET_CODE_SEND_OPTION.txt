Update added:
- Admin panel now has "Send Code" option for riders.
- When a driver sends Forgot Code / Reset Code request, admin can click:
  * Send Code: sends current secret code
  * Generate & Send: generates a new code and sends it
- Backend endpoint added:
  POST /api/admin/driver/:id/secret-code/send
- This endpoint sends the code via in-app DriverNotification.
- It also returns WhatsApp and SMS links; admin panel opens WhatsApp/SMS or copies the message.
- Last sent time is saved as secretCodeLastSentAt and shown in admin panel.
Note: Without a paid SMS/WhatsApp API, browser WhatsApp/SMS link is the safest working send option.
