const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');


// 1. DRIVER GO ONLINE API
// POST http://localhost:5000/api/driver/go-online
router.post('/go-online', async (req, res) => {
    try {
        const { driverId, latitude, longitude } = req.body;

        if (!driverId) {
            return res.status(400).json({
                success: false,
                message: "driverId required"
            });
        }

        const existingDriver = await Driver.findById(driverId);

        if (!existingDriver) {
            return res.status(404).json({
                success: false,
                message: "Driver nahi mila"
            });
        }

        if (existingDriver.approvalStatus === 'banned') {
            return res.status(403).json({
                success: false,
                message: "Aapka rider account ban hai",
                approvalStatus: 'banned',
                banReason: existingDriver.banReason || existingDriver.adminRemark || ''
            });
        }

        if (existingDriver.approvalStatus !== 'approved') {
            return res.status(403).json({
                success: false,
                message: "Admin approval ke baad hi online ja sakte ho",
                approvalStatus: existingDriver.approvalStatus || 'pending'
            });
        }

        const updateData = {
            isOnline: true,
            status: "available"
        };

        if (latitude && longitude) {
            updateData.location = {
                type: "Point",
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
            };
            updateData.lastLocationAt = new Date();
        }

        const driver = await Driver.findByIdAndUpdate(
            driverId,
            updateData,
            { new: true }
        );

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver nahi mila"
            });
        }

        res.status(200).json({
            success: true,
            message: "Driver Online Ho Gaya",
            driver
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
});


// 2. DRIVER GO OFFLINE API
// POST http://localhost:5000/api/driver/go-offline
router.post('/go-offline', async (req, res) => {
    try {
        const { driverId } = req.body;

        if (!driverId) {
            return res.status(400).json({
                success: false,
                message: "driverId required"
            });
        }

        const driver = await Driver.findByIdAndUpdate(
            driverId,
            {
                isOnline: false,
                status: "offline"
            },
            { new: true }
        );

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver nahi mila"
            });
        }

        res.status(200).json({
            success: true,
            message: "Driver Offline Ho Gaya",
            driver
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
});


// 3. UPDATE LIVE LOCATION API
// POST http://localhost:5000/api/driver/update-location
router.post('/update-location', async (req, res) => {
    try {
        const { driverId, latitude, longitude, isOnline } = req.body;

        if (!driverId || latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: "driverId, latitude, longitude required"
            });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({
                success: false,
                message: "Invalid latitude or longitude"
            });
        }

        const driver = await Driver.findById(driverId);

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver nahi mila"
            });
        }

        if (driver.approvalStatus === 'banned') {
            return res.status(403).json({
                success: false,
                message: "Aapka rider account ban hai",
                approvalStatus: 'banned',
                banReason: driver.banReason || driver.adminRemark || ''
            });
        }

        if (driver.approvalStatus !== 'approved') {
            return res.status(403).json({
                success: false,
                message: "Admin approval ke baad hi location update hoga",
                approvalStatus: driver.approvalStatus || 'pending'
            });
        }

        driver.isOnline = isOnline === undefined ? driver.isOnline : isOnline;
        driver.location = {
            type: "Point",
            coordinates: [lng, lat]
        };
        driver.lastLocationAt = new Date();

        if (driver.isOnline === false) {
            driver.status = "offline";
        } else if (driver.status !== "busy") {
            driver.status = "available";
        }

        await driver.save();

        const io = req.app.get('io');

        if (io) {
            io.emit(`driver-location-${driverId}`, {
                driverId,
                latitude: lat,
                longitude: lng,
                isOnline: driver.isOnline,
                status: driver.status,
                lastLocationAt: driver.lastLocationAt
            });
        }

        res.status(200).json({
            success: true,
            message: "Location Successfully Update Ho Gayi!",
            driver
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
});


// 4. NEARBY AVAILABLE DRIVER CHECK API
// GET http://localhost:5000/api/driver/nearby?latitude=26.7271&longitude=88.3953
router.get('/nearby', async (req, res) => {
    try {
        const { latitude, longitude } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "latitude and longitude required"
            });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        const drivers = await Driver.find({
            isOnline: true,
            status: "available",
            approvalStatus: "approved",
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    $maxDistance: 10000
                }
            }
        }).limit(10);

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
});


module.exports = router;