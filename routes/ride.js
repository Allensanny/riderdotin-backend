const express = require('express');
const router = express.Router();

const Ride = require('../models/Ride');
const Driver = require('../models/Driver');

function generateOtp() {
    return String(Math.floor(1000 + Math.random() * 9000));
}

function buildRidePayload(ride) {
    return {
        success: true,
        ride,
        rider: {
            name: ride.riderName,
            phone: ride.riderPhone
        },
        pickup: ride.pickupLocation,
        drop: ride.dropLocation,
        fare: ride.fare,
        distanceKm: ride.distanceKm,
        expiresInSeconds: 10,
        realRequest: true
    };
}

function startRideRepeat(req, rideId, driverId) {
    const io = req.app.get('io');
    if (!io) return;

    let attempts = 0;
    const sendOnce = async () => {
        try {
            const ride = await Ride.findById(rideId);
            if (!ride || !['assigned', 'searching'].includes(ride.status)) {
                clearInterval(timer);
                return;
            }
            attempts += 1;
            const payload = buildRidePayload(ride);

            // If captain is pre-assigned, send to that captain only.
            // If no captain is online yet, broadcast to every online driver socket.
            if (driverId) io.to(`driver-${driverId}`).emit('new-ride-request', payload);
            else io.emit('new-ride-request', payload);

            if (attempts >= 30) clearInterval(timer);
        } catch (e) {
            clearInterval(timer);
        }
    };

    sendOnce();
    const timer = setInterval(sendOnce, 10000);
}


// 1. BOOK RIDE API
// POST http://localhost:5000/api/ride/book
router.post('/book', async (req, res) => {
    try {
        const {
            userId,
            riderName,
            riderPhone,
            pickupAddress,
            pickupLat,
            pickupLng,
            dropAddress,
            dropLat,
            dropLng,
            fare,
            distanceKm,
            vehicleType,
            paymentMode
        } = req.body;

        if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
            return res.status(400).json({
                success: false,
                message: "Pickup and drop location are required"
            });
        }

        const pLat = parseFloat(pickupLat);
        const pLng = parseFloat(pickupLng);
        const dLat = parseFloat(dropLat);
        const dLng = parseFloat(dropLng);

        if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
            return res.status(400).json({
                success: false,
                message: "Invalid location coordinates"
            });
        }

        // Step A: nearest online available driver find karo
        const nearbyDrivers = await Driver.find({
            isOnline: true,
            status: 'available',
            approvalStatus: 'approved',
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [pLng, pLat]
                    },
                    $maxDistance: 5000
                }
            }
        }).limit(1);

        const assignedDriver = nearbyDrivers.length > 0 ? nearbyDrivers[0] : null;

        // Step B: ride create karo, lekin accepted nahi
        const newRide = new Ride({
            userId: userId || null,
            driverId: assignedDriver ? assignedDriver._id : null,
            riderName: riderName || "Customer",
            riderPhone: riderPhone || "",
            pickupLocation: {
                address: pickupAddress || "Pickup Location",
                coordinates: [pLng, pLat]
            },
            dropLocation: {
                address: dropAddress || "Drop Location",
                coordinates: [dLng, dLat]
            },
            fare: fare || 0,
            distanceKm: distanceKm || 0,
            vehicleType: vehicleType || 'Bike',
            paymentMode: paymentMode || 'cash',
            status: 'assigned',
            startOtp: generateOtp()
        });

        await newRide.save();

        // Step C: if a nearby captain is available, reserve him. Otherwise keep searching and broadcast request.
        if (assignedDriver) {
            assignedDriver.status = 'busy';
            await assignedDriver.save();
        }

        // Step D: Socket.IO se driver app ko real ride request bhejo.
        // If no driver online now, request will still be created and broadcast for future/online drivers.
        startRideRepeat(req, newRide._id, assignedDriver ? assignedDriver._id : null);

        res.status(201).json({
            success: true,
            message: "Ride request sent to captain",
            customerStartOtp: newRide.startOtp,
            ride: newRide,
            assignedDriver: assignedDriver ? {
                id: assignedDriver._id,
                name: assignedDriver.name,
                phone: assignedDriver.phone,
                vehicleNumber: assignedDriver.vehicleNumber,
                vehicleType: assignedDriver.vehicleType,
                rating: assignedDriver.rating
            } : null
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});


// 2. DRIVER ACCEPT RIDE API
// POST http://localhost:5000/api/ride/accept
router.post('/accept', async (req, res) => {
    try {
        const { rideId, driverId } = req.body;

        if (!rideId || !driverId) {
            return res.status(400).json({
                success: false,
                message: "rideId and driverId are required"
            });
        }

        const ride = await Ride.findById(rideId);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: "Ride not found"
            });
        }

        if (ride.status !== 'assigned' && ride.status !== 'searching') {
            return res.status(400).json({ success: false, message: "Ride already accepted or not available" });
        }

        if (ride.driverId && ride.driverId.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "This ride is not assigned to this driver"
            });
        }

        if (!ride.driverId) ride.driverId = driverId;
        ride.status = 'accepted';
        ride.acceptedAt = new Date();
        await ride.save();

        await Driver.findByIdAndUpdate(driverId, {
            status: 'busy',
            isOnline: true
        });

        const io = req.app.get('io');

        if (io) {
            io.emit(`ride-accepted-${ride._id}`, {
                success: true,
                message: "Captain accepted the ride",
                ride
            });
        }

        res.status(200).json({
            success: true,
            message: "Ride accepted successfully",
            ride
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});


// 3. DRIVER REJECT RIDE API
// POST http://localhost:5000/api/ride/reject
router.post('/reject', async (req, res) => {
    try {
        const { rideId, driverId } = req.body;

        if (!rideId || !driverId) {
            return res.status(400).json({
                success: false,
                message: "rideId and driverId are required"
            });
        }

        const ride = await Ride.findById(rideId);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: "Ride not found"
            });
        }

        ride.status = 'rejected';
        ride.rejectedDrivers.push(driverId);
        await ride.save();

        await Driver.findByIdAndUpdate(driverId, {
            status: 'available',
            isOnline: true
        });

        const io = req.app.get('io');

        if (io) {
            io.emit(`ride-rejected-${ride._id}`, {
                success: true,
                message: "Captain rejected the ride",
                ride
            });
        }

        res.status(200).json({
            success: true,
            message: "Ride rejected successfully",
            ride
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});




// 3A. DRIVER REACHED PICKUP API
// POST /api/ride/reach-pickup
router.post('/reach-pickup', async (req, res) => {
    try {
        const { rideId, driverId } = req.body;
        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        if (ride.driverId.toString() !== driverId) return res.status(403).json({ success: false, message: "Unauthorized driver" });
        if (!['accepted', 'reached_pickup'].includes(ride.status)) return res.status(400).json({ success: false, message: "Ride is not in accepted status" });

        ride.status = 'reached_pickup';
        ride.reachedPickupAt = new Date();
        await ride.save();

        const io = req.app.get('io');
        if (io) io.emit(`driver-reached-pickup-${ride._id}`, { success: true, ride });

        res.json({ success: true, message: "Driver reached pickup", ride });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});


// 3B. START RIDE WITH CUSTOMER OTP API
// POST /api/ride/start-with-otp
router.post('/start-with-otp', async (req, res) => {
    try {
        const { rideId, driverId, otp } = req.body;
        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        if (ride.driverId.toString() !== driverId) return res.status(403).json({ success: false, message: "Unauthorized driver" });
        if (ride.status !== 'reached_pickup') return res.status(400).json({ success: false, message: "Reach pickup location first" });
        if (!otp || String(otp).trim() !== String(ride.startOtp)) {
            return res.status(400).json({ success: false, message: "Invalid OTP. Enter the OTP shown in the customer app." });
        }

        ride.status = 'started';
        ride.startedAt = new Date();
        await ride.save();

        const io = req.app.get('io');
        if (io) io.emit(`ride-started-${ride._id}`, { success: true, ride });

        res.json({ success: true, message: "Ride started with OTP", ride });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});


// 3C. DRIVER REACHED DESTINATION / END RIDE API
// POST /api/ride/end
router.post('/end', async (req, res) => {
    try {
        const { rideId, driverId } = req.body;
        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        if (ride.driverId.toString() !== driverId) return res.status(403).json({ success: false, message: "Unauthorized driver" });
        if (ride.status !== 'started') return res.status(400).json({ success: false, message: "Ride is not started" });

        ride.status = 'ended';
        ride.endedAt = new Date();
        await ride.save();

        const io = req.app.get('io');
        if (io) io.emit(`ride-ended-${ride._id}`, { success: true, ride });

        res.json({ success: true, message: "Destination reached. Complete ride with rating.", ride });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});


// 3D. COMPLETE RIDE WITH DRIVER RATING API
// POST /api/ride/complete-with-rating
router.post('/complete-with-rating', async (req, res) => {
    try {
        const { rideId, driverId, customerRatingByDriver, driverFeedback } = req.body;
        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        if (ride.driverId.toString() !== driverId) return res.status(403).json({ success: false, message: "Unauthorized driver" });
        if (!['ended', 'started'].includes(ride.status)) return res.status(400).json({ success: false, message: "Ride has not ended" });

        ride.status = 'completed';
        ride.completedAt = new Date();
        ride.customerRatingByDriver = Math.max(1, Math.min(5, parseInt(customerRatingByDriver || 5, 10)));
        ride.driverFeedback = driverFeedback || '';
        await ride.save();

        await Driver.findByIdAndUpdate(driverId, {
            status: 'available',
            isOnline: true,
            $inc: { orders: 1 }
        });

        const io = req.app.get('io');
        if (io) io.emit(`ride-completed-${ride._id}`, { success: true, ride });

        res.json({ success: true, message: "Ride completed and rating submitted", ride });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});



// 4. START RIDE API
// POST http://localhost:5000/api/ride/start
router.post('/start', async (req, res) => {
    try {
        const { rideId, driverId } = req.body;

        const ride = await Ride.findById(rideId);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: "Ride not found"
            });
        }

        if (ride.driverId.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized driver"
            });
        }

        ride.status = 'started';
        ride.startedAt = new Date();
        await ride.save();

        res.status(200).json({
            success: true,
            message: "Ride started",
            ride
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});


// 5. COMPLETE RIDE API
// POST http://localhost:5000/api/ride/complete
router.post('/complete', async (req, res) => {
    try {
        const { rideId, driverId } = req.body;

        const ride = await Ride.findById(rideId);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: "Ride not found"
            });
        }

        if (ride.driverId.toString() !== driverId) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized driver"
            });
        }

        ride.status = 'completed';
        ride.completedAt = new Date();
        await ride.save();

        await Driver.findByIdAndUpdate(driverId, {
            status: 'available',
            isOnline: true,
            $inc: { orders: 1 }
        });

        const io = req.app.get('io');
        if (io) io.emit(`ride-completed-${ride._id}`, { success: true, ride });

        res.status(200).json({
            success: true,
            message: "Ride completed",
            ride
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});


// 6. GET RIDE STATUS API
// GET http://localhost:5000/api/ride/status/RIDE_ID
router.get('/status/:rideId', async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.rideId)
            .populate('driverId', 'name phone vehicleNumber vehicleType rating location');

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: "Ride not found"
            });
        }

        res.status(200).json({
            success: true,
            ride
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});


// 7. CUSTOMER CANCEL RIDE API
// POST /api/ride/cancel
router.post('/customer-cancel', async (req, res) => { req.url = '/cancel'; router.handle(req, res); });

router.post('/cancel', async (req, res) => {
    try {
        const { rideId, userId, reason } = req.body;

        if (!rideId) {
            return res.status(400).json({ success: false, message: "rideId is required" });
        }

        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

        if (userId && ride.userId && ride.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: "This ride does not belong to this customer" });
        }

        if (['completed', 'cancelled'].includes(ride.status)) {
            return res.status(400).json({ success: false, message: "This ride cannot be cancelled now" });
        }

        ride.status = 'cancelled';
        ride.customerCancelReason = reason || 'Customer cancelled';
        await ride.save();

        if (ride.driverId) {
            await Driver.findByIdAndUpdate(ride.driverId, {
                status: 'available',
                isOnline: true
            });
        }

        const io = req.app.get('io');
        if (io) {
            io.emit(`ride-cancelled-${ride._id}`, { success: true, ride, reason: ride.customerCancelReason });
            io.emit('ride-cancelled', { success: true, ride, reason: ride.customerCancelReason });
            if (ride.driverId) io.to(`driver-${ride.driverId}`).emit('ride-cancelled', { success: true, ride, reason: ride.customerCancelReason });
        }

        res.json({ success: true, message: "Ride cancelled successfully", ride });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});


// 8. CUSTOMER RIDE HISTORY API
// CUSTOMER RATE DRIVER API
// POST /api/ride/rate
router.post('/rate', async (req, res) => {
    try {
        const { rideId, userId, rating, comment } = req.body;
        if (!rideId) return res.status(400).json({ success: false, message: "rideId is required" });
        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
        if (userId && ride.userId && ride.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: "This ride does not belong to this customer" });
        }
        if (ride.status !== 'completed') {
            return res.status(400).json({ success: false, message: "You can rate only after ride completion" });
        }
        const value = Math.max(1, Math.min(5, parseInt(rating || 5, 10)));
        ride.customerRatingByCustomer = value;
        ride.customerFeedbackForDriver = comment || '';
        await ride.save();
        if (ride.driverId) {
            await Driver.findByIdAndUpdate(ride.driverId, { rating: value });
        }
        res.json({ success: true, message: "Rating submitted", ride });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

// GET /api/ride/history/:userId
router.get('/history/:userId', async (req, res) => {
    try {
        const rides = await Ride.find({ userId: req.params.userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('driverId', 'name phone vehicleNumber vehicleType rating');

        res.json({ success: true, rides });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});


module.exports = router;