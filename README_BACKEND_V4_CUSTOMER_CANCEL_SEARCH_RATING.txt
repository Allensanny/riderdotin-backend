RideDotIn Backend v4:
- /api/ride/book no longer fails when no captain is online. Ride request is created and broadcast/searching continues.
- /api/ride/cancel accepts { rideId, userId, reason } and emits ride-cancelled with reason to rider/driver app sockets.
- /api/ride/rate accepts customer rating after ride completion.
- /api/ride/complete emits ride-completed so customer app can show fare/rating screen.
- Ride history endpoint remains /api/ride/history/:userId.

Deploy/redeploy this backend on Render or your server before testing v4 customer app.
