RideDotIn Backend - Admin Approval Flow

Required Render Environment Variables:
1) MONGO_URI = your MongoDB Atlas URI
2) JWT_SECRET = any strong random text
3) ADMIN_PASSWORD = admin panel password
4) PORT = 10000

Important URLs after deploy:
- Backend health: https://your-render-url.onrender.com/api/health
- Admin panel: https://your-render-url.onrender.com/admin

Driver flow:
- New driver registers from Android app with RC, PAN, Aadhaar, DL numbers + files.
- Driver cannot login until admin approves.
- Admin opens /admin, enters ADMIN_PASSWORD, reviews documents, then Approve or Reject.
- Approved driver can login and go online.
