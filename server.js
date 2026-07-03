require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Server } = require('socket.io');

const Driver = require('./models/Driver');

const app = express();

const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cors());

// Driver document uploads
const uploadDir = path.join(__dirname, 'uploads', 'driver-documents');
fs.mkdirSync(uploadDir, { recursive: true });

const driverDocumentStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeExt = path.extname(file.originalname || '').toLowerCase();
        const cleanField = String(file.fieldname || 'document').replace(/[^a-z0-9]/gi, '');
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + '-' + cleanField + safeExt);
    }
});

const driverDocumentsUpload = multer({
    storage: driverDocumentStorage,
    limits: { fileSize: 25 * 1024 * 1024, files: 4 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowed.includes(file.mimetype)) return cb(new Error('Only JPG, PNG, WEBP or PDF files allowed'));
        cb(null, true);
    }
});

app.set('driverDocumentsUpload', driverDocumentsUpload);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'public')));

// HTTP Server
const server = http.createServer(app);

// Socket.IO Server
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Routes ke andar Socket.IO use karne ke liye
app.set('io', io);

// MongoDB Connection
// Password me @ tha, isliye @ ko %40 kiya gaya hai
// Database name: riderdotin
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ridedotin";

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("🚀 MongoDB Connected Successfully!");
    })
    .catch((err) => {
        console.log("❌ DB Connection Error:", err.message);
    });


// ===============================
// ROUTES
// ===============================

app.use('/api/auth', require('./routes/auth'));
app.use('/api/driver', require('./routes/driverAuth'));
app.use('/api/driver', require('./routes/driverLocation'));
app.use('/api/ride', require('./routes/ride'));
app.use('/api/admin', require('./routes/admin'));


// Website Home Page
// Root domain par stylish landing page show hoga.
// Admin panel same rahega: /admin
app.get(['/', '/home'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});


// Android App Backend Status Check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: "Backend Connected",
        database: mongoose.connection.readyState === 1
            ? "MongoDB Connected"
            : "MongoDB Disconnected",
        port: PORT
    });
});


// ===============================
// SOCKET.IO REAL-TIME LOGIC
// ===============================

io.on('connection', (socket) => {
    console.log(`🔌 Naya Device Connect Hua! Socket ID: ${socket.id}`);


    // Driver app login hone ke baad ye call karega
    // Driver private room join karega
    socket.on('driver-join', async (data) => {
        try {
            const { driverId } = data;

            if (!driverId) {
                console.log("❌ driverId missing in driver-join");
                return;
            }

            socket.join(`driver-${driverId}`);

            await Driver.findByIdAndUpdate(driverId, {
                socketId: socket.id
            });

            console.log(`✅ Driver room join hua: driver-${driverId}`);

            socket.emit('driver-join-success', {
                success: true,
                message: "Driver socket connected successfully",
                driverId: driverId
            });

        } catch (error) {
            console.log("❌ driver-join error:", error.message);

            socket.emit('driver-join-error', {
                success: false,
                message: error.message
            });
        }
    });


    // Rider/User app ride tracking ke liye room join karega
    socket.on('rider-join', (data) => {
        try {
            const { rideId } = data;

            if (!rideId) {
                console.log("❌ rideId missing in rider-join");
                return;
            }

            socket.join(`ride-${rideId}`);

            console.log(`✅ Rider room join hua: ride-${rideId}`);

            socket.emit('rider-join-success', {
                success: true,
                message: "Rider socket connected successfully",
                rideId: rideId
            });

        } catch (error) {
            console.log("❌ rider-join error:", error.message);
        }
    });


    // Driver live location Socket.IO se bhejega
    socket.on('update-live-location', async (data) => {
        try {
            const { driverId, latitude, longitude, isOnline, rideId } = data;

            if (!driverId || latitude === undefined || longitude === undefined) {
                console.log("❌ Location data missing");
                return;
            }

            const lat = parseFloat(latitude);
            const lng = parseFloat(longitude);

            if (isNaN(lat) || isNaN(lng)) {
                console.log("❌ Invalid latitude/longitude");
                return;
            }

            const driver = await Driver.findById(driverId);

            if (!driver) {
                console.log("❌ Driver nahi mila:", driverId);
                return;
            }

            if (driver.approvalStatus !== 'approved') {
                console.log("❌ Driver approved nahi hai:", driverId);
                return;
            }

            driver.location = {
                type: "Point",
                coordinates: [lng, lat]
            };

            driver.lastLocationAt = new Date();

            if (isOnline !== undefined) {
                driver.isOnline = isOnline;
            }

            if (driver.isOnline === false) {
                driver.status = "offline";
            } else if (driver.status !== "busy") {
                driver.status = "available";
            }

            driver.socketId = socket.id;

            await driver.save();

            console.log(`📍 Driver ${driverId} location update: [${lat}, ${lng}]`);

            const locationPayload = {
                success: true,
                driverId: driverId,
                latitude: lat,
                longitude: lng,
                isOnline: driver.isOnline,
                status: driver.status,
                lastLocationAt: driver.lastLocationAt
            };

            // Specific driver tracking event
            io.emit(`driver-location-${driverId}`, locationPayload);

            // Agar rideId hai to specific ride room me bhi location bhejo
            if (rideId) {
                io.to(`ride-${rideId}`).emit('driver-live-location', locationPayload);
            }

        } catch (error) {
            console.log("❌ update-live-location error:", error.message);

            socket.emit('location-update-error', {
                success: false,
                message: error.message
            });
        }
    });


    // Driver app se manually online event
    socket.on('driver-online', async (data) => {
        try {
            const { driverId, latitude, longitude } = data;

            if (!driverId) {
                console.log("❌ driverId missing in driver-online");
                return;
            }

            const existingDriver = await Driver.findById(driverId);
            if (!existingDriver || existingDriver.approvalStatus !== 'approved') {
                socket.emit('driver-online-error', {
                    success: false,
                    message: existingDriver ? 'Driver admin approved nahi hai' : 'Driver nahi mila'
                });
                return;
            }

            const updateData = {
                isOnline: true,
                status: "available",
                socketId: socket.id
            };

            if (latitude !== undefined && longitude !== undefined) {
                updateData.location = {
                    type: "Point",
                    coordinates: [parseFloat(longitude), parseFloat(latitude)]
                };
            }

            const driver = await Driver.findByIdAndUpdate(
                driverId,
                updateData,
                { new: true }
            );

            if (!driver) {
                socket.emit('driver-online-error', {
                    success: false,
                    message: "Driver nahi mila"
                });
                return;
            }

            socket.join(`driver-${driverId}`);

            socket.emit('driver-online-success', {
                success: true,
                message: "Driver online ho gaya",
                driver: driver
            });

            console.log(`🟢 Driver Online: ${driverId}`);

        } catch (error) {
            console.log("❌ driver-online error:", error.message);
        }
    });


    // Driver app se manually offline event
    socket.on('driver-offline', async (data) => {
        try {
            const { driverId } = data;

            if (!driverId) {
                console.log("❌ driverId missing in driver-offline");
                return;
            }

            const driver = await Driver.findByIdAndUpdate(
                driverId,
                {
                    isOnline: false,
                    status: "offline",
                    socketId: ""
                },
                { new: true }
            );

            socket.leave(`driver-${driverId}`);

            socket.emit('driver-offline-success', {
                success: true,
                message: "Driver offline ho gaya",
                driver: driver
            });

            console.log(`🔴 Driver Offline: ${driverId}`);

        } catch (error) {
            console.log("❌ driver-offline error:", error.message);
        }
    });


    // Phone lock / network sleep par socket disconnect ho sakta hai.
    // Isliye disconnect par driver ko auto-offline NAHI karenge.
    // Driver sirf app ke OFF DUTY button se offline hoga.
    socket.on('disconnect', async () => {
        try {
            console.log(`❌ Device Socket Disconnect Hua: ${socket.id}`);

            const driver = await Driver.findOneAndUpdate(
                { socketId: socket.id },
                { socketId: "" },
                { new: true }
            );

            if (driver) {
                console.log(`🟡 Socket cleared, driver online status same rakha gaya: ${driver._id}`);
            }

        } catch (error) {
            console.log("❌ disconnect error:", error.message);
        }
    });
});


// ===============================
// 404 HANDLER
// ===============================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});


// ===============================
// SERVER START
// ===============================

server.listen(PORT, () => {
    console.log(`🎯 Real-time Server is running on port ${PORT}`);
});