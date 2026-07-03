Merged backend update:

Base: user's uploaded riderdotin-backend-main(1).zip
Merged feature: new Secret Code Login + Admin Secret Code Set/Reset

Kept from existing backend:
- Existing server.js and home page behavior
- Existing admin panel, document upload/edit/view, live map, ban/unban, notifications, ride flow
- Existing package.json and deployment setup

Added:
- Driver model fields: secretCode, secretCodeResetRequested, secretCodeResetRequestedAt, secretCodeUpdatedAt
- Driver login requires secretCode after phone for approved drivers
- POST /api/driver/secret-code-reset-request
- Admin: Set / Reset Secret Code button
- Admin: reset request status and clear request
- Admin logs for secret code changes

Deploy:
1. Push this merged backend to GitHub.
2. Render -> Manual Deploy -> Deploy latest commit.
3. Admin panel -> set secret code for approved rider.
4. Android app -> login phone -> enter secret code.
