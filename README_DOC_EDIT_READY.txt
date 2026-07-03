RideDotIn Backend - Admin Document View/Edit Ready

Added:
- Driver personal fields: address, email, age, state.
- Registration validation for personal details + Aadhaar/PAN/RC/DL.
- 25MB per document upload limit.
- Admin panel document view / preview / edit option.
- Admin can edit rider details, document numbers, status, and remark.
- Admin can approve/reject/delete drivers.

Deploy:
1. Open this folder in VS Code.
2. Run:
   rm -rf node_modules .git
   git init
   git branch -M main
   git add .
   git commit -m "Admin document edit approval system"
   git remote add origin https://github.com/Allensanny/riderdotin-backend.git
   git push -u origin main --force
3. Render > riderdotin-backend > Manual Deploy > Deploy latest commit.
4. Environment variables:
   MONGO_URI=your MongoDB Atlas URL
   JWT_SECRET=your secret
   ADMIN_PASSWORD=your admin password
   PORT=10000

Admin panel:
https://riderdotin-backend.onrender.com/admin
