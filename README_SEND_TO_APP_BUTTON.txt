Update added:
- Admin panel now has a separate "Send to App" button.
- "Send to App" sends the secret code through the in-app driver notification system only.
- Existing "Send Code" button still opens/copies WhatsApp/SMS options.
- Backend endpoint reused: POST /api/admin/driver/:id/secret-code/send with appOnly=true.
