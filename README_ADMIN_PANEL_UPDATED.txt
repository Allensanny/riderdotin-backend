RideDotIn Backend - Admin User Login + Document Upload + Live Rider Map

New features:
1. Admin panel login has Admin User ID + Password.
2. Admin can view, edit, approve/reject rider registrations.
3. Admin can upload/replace rider documents from panel: Aadhaar, PAN, RC, DL.
4. Document upload file limit: 25MB per file. Allowed: JPG, PNG, WEBP, PDF.
5. Live Location Map page shows approved riders, total online riders, and driver locations.
6. Live map/list refreshes every 3 seconds.

Render Environment Variables:
MONGO_URI=your_mongodb_url
JWT_SECRET=your_secret_key
ADMIN_USER=admin
ADMIN_PASSWORD=your_password
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
PORT=10000

Admin panel URL:
https://riderdotin-backend.onrender.com/admin
