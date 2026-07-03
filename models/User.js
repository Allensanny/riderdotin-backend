const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({

    name: {
        type: String,
        default: "Customer"
    },

    phone: {
        type: String,
        unique: true,
        required: true
    },

    email: {
        type: String,
        unique: true,
        sparse: true,
        default: undefined
    },

    password: {
        type: String,
        default: ""
    },

    profileImage: {
        type: String,
        default: ""
    },

    city: {
        type: String,
        default: "Siliguri"
    },

    isActive: {
        type: Boolean,
        default: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model('User', UserSchema);