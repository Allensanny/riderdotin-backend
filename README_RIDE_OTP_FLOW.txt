Ride OTP flow:
- /api/ride/book generates startOtp and returns customerStartOtp to customer app.
- Driver accepts request, then sees customer name/phone and in-app pickup map.
- /api/ride/reach-pickup after driver slides reach location.
- /api/ride/start-with-otp verifies OTP from customer app before starting ride.
- /api/ride/end after destination slide.
- /api/ride/complete-with-rating submits driver rating for customer and completes ride.
