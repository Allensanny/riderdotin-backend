const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        default: null
    },

    riderName: {
        type: String,
        default: "Customer"
    },

    riderPhone: {
        type: String,
        default: ""
    },

    pickupLocation: {
        address: {
            type: String,
            default: ""
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
            // [Longitude, Latitude]
        }
    },

    dropLocation: {
        address: {
            type: String,
            default: ""
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
            // [Longitude, Latitude]
        }
    },

    fare: {
        type: Number,
        default: 0
    },

    distanceKm: {
        type: Number,
        default: 0
    },

    vehicleType: {
        type: String,
        default: "Bike"
    },

    paymentMode: {
        type: String,
        enum: ['cash', 'online'],
        default: 'cash'
    },

    status: {
        type: String,
        enum: [
            'requested',
            'searching',
            'assigned',
            'accepted',
            'rejected',
            'reached_pickup',
            'started',
            'ended',
            'completed',
            'cancelled'
        ],
        default: 'requested'
    },

    rejectedDrivers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver'
    }],

    acceptedAt: {
        type: Date,
        default: null
    },

    startedAt: {
        type: Date,
        default: null
    },

    reachedPickupAt: {
        type: Date,
        default: null
    },

    startOtp: {
        type: String,
        default: ""
    },

    endedAt: {
        type: Date,
        default: null
    },

    completedAt: {
        type: Date,
        default: null
    },

    driverRatingByCustomer: {
        type: Number,
        default: null
    },

    customerRatingByDriver: {
        type: Number,
        default: null
    },

    driverFeedback: {
        type: String,
        default: ""
    },

    customerCancelReason: {
        type: String,
        default: ""
    },

    customerRatingByCustomer: {
        type: Number,
        default: null
    },

    customerFeedbackForDriver: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('Ride', RideSchema);