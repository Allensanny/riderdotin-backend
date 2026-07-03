RideDotIn Backend - Customer App Ready Update

Added/updated for customer app:
1. Customer login/register already available under /api/auth.
2. Customer ride booking continues to use POST /api/ride/book.
3. /api/ride/book now saves vehicleType and paymentMode.
4. New customer cancel endpoint: POST /api/ride/cancel.
5. New customer history endpoint: GET /api/ride/history/:userId.
6. Customer-facing auth/ride messages were changed to English where this update touched the code.

Deploy steps:
1. Upload these backend files to GitHub or Render.
2. Set environment variable MONGO_URI in Render.
3. Deploy/redeploy the service.
4. In the customer app, confirm ApiConfig.BASE_URL points to your Render backend URL ending with /api/.
