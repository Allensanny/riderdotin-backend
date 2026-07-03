const mongoose = require('mongoose');

const DriverNotificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null, index: true },
    target: { type: String, enum: ['all', 'driver'], default: 'all', index: true },
    sentBy: { type: String, default: "admin" },
    createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('DriverNotification', DriverNotificationSchema);
