RideDotIn Backend Admin Login + Map Zoom Fix

Changes:
- Admin panel now shows only User ID + Password login first.
- Rider Documents, Live Location Map, Help, Search, Status options appear only after successful admin login.
- Added Logout button.
- Live Location Map no longer auto-fit/auto-zoom every 3 seconds. Admin's selected zoom-out/zoom level stays the same during live refresh.
- Added Fit All Riders button to manually zoom out and show all riders when needed.

Deploy:
1. Push this backend to GitHub.
2. Render -> Manual Deploy -> Deploy latest commit.
3. Clear browser cache or open admin panel in incognito if old UI appears.

Required Render environment variables:
MONGO_URI
JWT_SECRET
ADMIN_USER
ADMIN_PASSWORD
GOOGLE_MAPS_API_KEY
PORT=10000
