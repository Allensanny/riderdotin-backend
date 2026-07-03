RideDotIn Backend V5 - Customer App Super Fix Support

This backend package supports the Customer App V5 flow:
- Customer ride booking can be created even if no online captain is immediately available.
- Customer cancellation supports reason and emits ride-cancelled event to rider/driver app.
- Customer rating API is available at POST /api/ride/rate.
- Ride history API is available at GET /api/ride/history/:userId.
- Ride status API is available at GET /api/ride/status/:rideId.

Important: Redeploy backend after uploading this version. If old backend remains live, customer app may show API not found for cancel/rating.
