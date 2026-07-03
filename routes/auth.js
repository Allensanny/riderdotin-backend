const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 1. SIGNUP API (http://localhost:5000/api/auth/signup)
router.post('/signup', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        let user = await User.findOne({ phone });
        if (user) return res.status(400).json({ message: "Mobile number is already registered" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ name, email, phone, password: hashedPassword });
        await user.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// 2. LOGIN API (http://localhost:5000/api/auth/login)
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;

        const user = await User.findOne({ phone });
        if (!user) return res.status(400).json({ message: "Invalid phone number or password" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid phone number or password" });

        const token = jwt.sign({ userId: user._id }, 'MY_SECRET_KEY', { expiresIn: '7d' });

        res.status(200).json({
            message: "Login successful",
            token,
            user: { id: user._id, name: user.name, phone: user.phone }
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = router;