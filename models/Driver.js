const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    number: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    originalName: { type: String, default: "" }
}, { _id: false });

const DriverSchema = new mongoose.Schema({
    name: {
        type: String,
        default: "Rider"
    },

    phone: {
        type: String,
        unique: true,
        required: true,
        index: true
    },

    address: {
        type: String,
        default: ""
    },

    email: {
        type: String,
        default: ""
    },

    age: {
        type: Number,
        default: null
    },

    state: {
        type: String,
        default: "West Bengal"
    },

    vehicleNumber: {
        type: String,
        default: ""
    },

    vehicleType: {
        type: String,
        default: "Bike"
    },

    city: {
        type: String,
        default: "Siliguri"
    },

    rating: {
        type: Number,
        default: 5
    },

    orders: {
        type: Number,
        default: 0
    },

    years: {
        type: Number,
        default: 0
    },

    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'banned'],
        default: 'pending',
        index: true
    },

    adminRemark: {
        type: String,
        default: ""
    },

    approvedAt: {
        type: Date,
        default: null
    },

    rejectedAt: {
        type: Date,
        default: null
    },

    bannedAt: {
        type: Date,
        default: null
    },

    banReason: {
        type: String,
        default: ""
    },


    secretCode: {
        type: String,
        default: ""
    },

    secretCodeResetRequested: {
        type: Boolean,
        default: false
    },

    secretCodeResetRequestedAt: {
        type: Date,
        default: null
    },

    secretCodeUpdatedAt: {
        type: Date,
        default: null
    },

    secretCodeLastSentAt: {
        type: Date,
        default: null
    },

    secretCodeSentToApp: {
        type: Boolean,
        default: false
    },

    secretCodeSentToAppAt: {
        type: Date,
        default: null
    },

    documents: {
        rc: { type: DocumentSchema, default: () => ({}) },
        pan: { type: DocumentSchema, default: () => ({}) },
        aadhaar: { type: DocumentSchema, default: () => ({}) },
        dl: { type: DocumentSchema, default: () => ({}) }
    },

    isOnline: {
        type: Boolean,
        default: false
    },

    status: {
        type: String,
        enum: ['available', 'busy', 'offline'],
        default: 'offline'
    },

    socketId: {
        type: String,
        default: ""
    },

    lastLocationAt: {
        type: Date,
        default: null
    },

    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

DriverSchema.index({ location: "2dsphere" });

module.exports = mongoose.model('Driver', DriverSchema);
