const mongoose = require('mongoose');

const AdminLogSchema = new mongoose.Schema({
    adminUser: { type: String, default: "admin", index: true },
    action: { type: String, required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
    driverName: { type: String, default: "" },
    driverPhone: { type: String, default: "" },
    details: { type: String, default: "" },
    meta: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('AdminLog', AdminLogSchema);
