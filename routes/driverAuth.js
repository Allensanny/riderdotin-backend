const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const path = require('path');
const Driver = require('../models/Driver');

const JWT_SECRET = process.env.JWT_SECRET || 'MY_SECRET_KEY';

function normalizePhone(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) digits = digits.substring(2);
    if (digits.length > 10) digits = digits.substring(digits.length - 10);
    return digits;
}

function normalizeSecretCode(code) {
    return String(code || '').trim();
}

function driverPayload(driver) {
    return {
        _id: driver._id,
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        address: driver.address || '',
        email: driver.email || '',
        age: driver.age || null,
        vehicleNumber: driver.vehicleNumber,
        vehicleType: driver.vehicleType || 'Bike',
        city: driver.city || 'Siliguri',
        state: driver.state || 'West Bengal',
        rating: driver.rating || 5,
        orders: driver.orders || 0,
        years: driver.years || 0,
        isOnline: driver.isOnline || false,
        approvalStatus: driver.approvalStatus || 'pending',
        adminRemark: driver.adminRemark || '',
        documents: driver.documents || {},
        banReason: driver.banReason || '',
        secretCodeSet: !!driver.secretCode,
        secretCodeResetRequested: !!driver.secretCodeResetRequested
    };
}

function fileUrl(req, file) {
    if (!file) return '';
    return `${req.protocol}://${req.get('host')}/uploads/driver-documents/${file.filename}`;
}

function getFile(req, fieldName) {
    if (!req.files) return null;
    const arr = req.files[fieldName];
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

function validateRegistration(body, files) {
    const requiredText = ['name', 'phone', 'address', 'email', 'age', 'city', 'state', 'vehicleNumber', 'rcNumber', 'panNumber', 'aadhaarNumber', 'dlNumber'];
    for (const key of requiredText) {
        if (!String(body[key] || '').trim()) return `${key} required`;
    }

    const phone = normalizePhone(body.phone);
    if (phone.length !== 10) return 'Valid 10 digit phone number required';

    const email = String(body.email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Valid email required';

    const age = parseInt(body.age, 10);
    if (Number.isNaN(age) || age < 18 || age > 80) return 'Age must be between 18 and 80.';

    const requiredFiles = ['rcFile', 'panFile', 'aadhaarFile', 'dlFile'];
    for (const key of requiredFiles) {
        if (!files || !files[key] || files[key].length === 0) return `${key} upload required`;
    }

    return null;
}

// 1. NEW DRIVER REGISTRATION WITH DOCUMENT UPLOAD
// POST /api/driver/register
router.post('/register', (req, res, next) => {
    const upload = req.app.get('driverDocumentsUpload');
    if (!upload) {
        return res.status(500).json({ success: false, message: 'Upload middleware not configured' });
    }

    upload.fields([
        { name: 'rcFile', maxCount: 1 },
        { name: 'panFile', maxCount: 1 },
        { name: 'aadhaarFile', maxCount: 1 },
        { name: 'dlFile', maxCount: 1 }
    ])(req, res, async (err) => {
        if (err) {
            let message = err.message || 'File upload error';
            if (err.code === 'LIMIT_FILE_SIZE') message = 'File too large. Each document must be smaller than 25MB.';
            if (err.code === 'LIMIT_FILE_COUNT') message = 'Maximum 4 document files allowed.';
            return res.status(400).json({ success: false, code: err.code || 'UPLOAD_ERROR', message });
        }

        try {
            const validationError = validateRegistration(req.body, req.files);
            if (validationError) {
                return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: validationError });
            }

            const phone = normalizePhone(req.body.phone);
            const existing = await Driver.findOne({ phone });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    code: existing.approvalStatus === 'approved' ? 'DRIVER_ALREADY_APPROVED' : 'DRIVER_ALREADY_REGISTERED',
                    message: existing.approvalStatus === 'approved'
                        ? 'This number is already approved. Please log in.'
                        : 'Registration has already been submitted. Please wait for admin approval.',
                    approvalStatus: existing.approvalStatus || 'pending'
                });
            }

            const rcFile = getFile(req, 'rcFile');
            const panFile = getFile(req, 'panFile');
            const aadhaarFile = getFile(req, 'aadhaarFile');
            const dlFile = getFile(req, 'dlFile');

            const driver = new Driver({
                name: String(req.body.name || '').trim(),
                phone,
                address: String(req.body.address || '').trim(),
                email: String(req.body.email || '').trim().toLowerCase(),
                age: parseInt(req.body.age, 10),
                vehicleNumber: String(req.body.vehicleNumber || '').trim().toUpperCase(),
                vehicleType: String(req.body.vehicleType || 'Bike').trim() || 'Bike',
                city: String(req.body.city || 'Siliguri').trim() || 'Siliguri',
                state: String(req.body.state || 'West Bengal').trim() || 'West Bengal',
                approvalStatus: 'pending',
                adminRemark: '',
                rating: 5,
                orders: 0,
                years: 0,
                isOnline: false,
                status: 'offline',
                documents: {
                    rc: { number: String(req.body.rcNumber || '').trim().toUpperCase(), fileUrl: fileUrl(req, rcFile), originalName: rcFile.originalname },
                    pan: { number: String(req.body.panNumber || '').trim().toUpperCase(), fileUrl: fileUrl(req, panFile), originalName: panFile.originalname },
                    aadhaar: { number: String(req.body.aadhaarNumber || '').trim(), fileUrl: fileUrl(req, aadhaarFile), originalName: aadhaarFile.originalname },
                    dl: { number: String(req.body.dlNumber || '').trim().toUpperCase(), fileUrl: fileUrl(req, dlFile), originalName: dlFile.originalname }
                },
                location: { type: 'Point', coordinates: [0, 0] }
            });

            await driver.save();

            res.status(201).json({
                success: true,
                code: 'REGISTRATION_PENDING_APPROVAL',
                message: 'Registration submitted successfully. You can log in after admin approval.',
                driver: driverPayload(driver)
            });
        } catch (error) {
            if (error && error.code === 11000) {
                return res.status(409).json({ success: false, code: 'DUPLICATE_PHONE', message: 'Phone number already registered' });
            }
            res.status(500).json({ success: false, message: 'Server Error', error: error.message });
        }
    });
});

// Compatibility signup route: approval pending only, no auto-login
router.post('/signup', async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);
        if (phone.length !== 10) {
            return res.status(400).json({ success: false, message: 'Valid 10 digit phone number required' });
        }

        const existing = await Driver.findOne({ phone });
        if (existing) {
            return res.status(409).json({
                success: false,
                code: 'DRIVER_ALREADY_REGISTERED',
                message: 'Driver is already registered. Status: ' + (existing.approvalStatus || 'pending'),
                approvalStatus: existing.approvalStatus || 'pending'
            });
        }

        const driver = new Driver({
            name: req.body.name || 'Rider',
            phone,
            address: req.body.address || '',
            email: req.body.email || '',
            age: req.body.age ? parseInt(req.body.age, 10) : null,
            vehicleNumber: req.body.vehicleNumber || '',
            city: req.body.city || 'Siliguri',
            state: req.body.state || 'West Bengal',
            approvalStatus: 'pending',
            isOnline: false,
            status: 'offline',
            location: { type: 'Point', coordinates: [0, 0] }
        });
        await driver.save();

        res.status(201).json({
            success: true,
            code: 'REGISTRATION_PENDING_APPROVAL',
            message: 'Registration submitted successfully. You can log in after admin approval.',
            driver: driverPayload(driver)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
});

async function loginByPhone(req, res) {
    try {
        const phone = normalizePhone(req.body.phone);
        if (phone.length !== 10) {
            return res.status(400).json({ success: false, code: 'PHONE_REQUIRED', message: 'Valid 10 digit phone number required' });
        }

        const driver = await Driver.findOne({ phone });
        if (!driver) {
            return res.status(404).json({
                success: false,
                code: 'DRIVER_NOT_REGISTERED',
                message: 'Driver is not registered. Please complete the registration form.'
            });
        }

        const approvalStatus = driver.approvalStatus || 'pending';
        if (approvalStatus === 'banned') {
            return res.status(403).json({
                success: false,
                code: 'DRIVER_BANNED',
                message: `Your rider account is banned. ${driver.banReason || driver.adminRemark || ''}`.trim(),
                approvalStatus,
                banReason: driver.banReason || driver.adminRemark || ''
            });
        }

        if (approvalStatus !== 'approved') {
            return res.status(403).json({
                success: false,
                code: approvalStatus === 'rejected' ? 'DRIVER_REJECTED' : 'DRIVER_PENDING_APPROVAL',
                message: approvalStatus === 'rejected'
                    ? `Your registration has been rejected. ${driver.adminRemark || ''}`.trim()
                    : 'Registration has been submitted. You can log in after admin approval.',
                approvalStatus,
                adminRemark: driver.adminRemark || ''
            });
        }

        const submittedCode = normalizeSecretCode(req.body.secretCode || req.body.code);
        if (!submittedCode) {
            return res.status(428).json({
                success: false,
                code: 'SECRET_CODE_REQUIRED',
                secretCodeRequired: true,
                message: 'Secret code is required. Enter the code set by the admin.',
                driverId: driver._id,
                phone: driver.phone
            });
        }

        if (!driver.secretCode) {
            return res.status(403).json({
                success: false,
                code: 'SECRET_CODE_NOT_SET',
                message: 'Secret code has not been set by admin. Please contact admin.',
                driverId: driver._id,
                phone: driver.phone
            });
        }

        if (submittedCode !== String(driver.secretCode || '')) {
            return res.status(401).json({
                success: false,
                code: 'INVALID_SECRET_CODE',
                message: 'Invalid secret code. Try again or use Forgot Code.'
            });
        }

        driver.secretCodeResetRequested = false;
        driver.secretCodeResetRequestedAt = null;
        driver.secretCodeSentToApp = false;
        driver.secretCodeSentToAppAt = null;
        await driver.save();

        const token = jwt.sign({ driverId: driver._id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            success: true,
            message: 'Driver Login Successful!',
            token,
            driver: driverPayload(driver)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
}


// Driver forgot secret code request
// POST /api/driver/secret-code-reset-request
router.post('/secret-code-reset-request', async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);
        if (phone.length !== 10) {
            return res.status(400).json({ success: false, code: 'PHONE_REQUIRED', message: 'Valid 10 digit phone number required' });
        }

        const driver = await Driver.findOne({ phone });
        if (!driver) {
            return res.status(404).json({ success: false, code: 'DRIVER_NOT_REGISTERED', message: 'Driver is not registered.' });
        }

        if ((driver.approvalStatus || 'pending') === 'banned') {
            return res.status(403).json({ success: false, code: 'DRIVER_BANNED', message: 'Banned drivers cannot request a secret code reset.' });
        }

        driver.secretCodeResetRequested = true;
        driver.secretCodeResetRequestedAt = new Date();
        await driver.save();

        res.json({
            success: true,
            code: 'SECRET_CODE_RESET_REQUESTED',
            message: 'Secret code reset request has been sent to the admin panel. Admin will set or send a code.'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
});



// Secret code request status without viewing or consuming the code
// POST /api/driver/secret-code-request-status
router.post('/secret-code-request-status', async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);
        if (phone.length !== 10) {
            return res.status(400).json({ success: false, code: 'PHONE_REQUIRED', message: 'Valid 10 digit phone number is required.' });
        }

        const driver = await Driver.findOne({ phone });
        if (!driver) {
            return res.status(404).json({ success: false, code: 'DRIVER_NOT_REGISTERED', message: 'Driver is not registered.' });
        }

        return res.json({
            success: true,
            requested: !!driver.secretCodeResetRequested,
            secretCodeSet: !!driver.secretCode,
            sentToApp: !!driver.secretCodeSentToApp
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// View requested secret code one time before login
// POST /api/driver/view-requested-secret-code
router.post('/view-requested-secret-code', async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);
        if (phone.length !== 10) {
            return res.status(400).json({ success: false, code: 'PHONE_REQUIRED', message: 'Valid 10 digit phone number is required.' });
        }

        const driver = await Driver.findOne({ phone });
        if (!driver) {
            return res.status(404).json({ success: false, code: 'DRIVER_NOT_REGISTERED', message: 'Driver is not registered.' });
        }

        if ((driver.approvalStatus || 'pending') === 'banned') {
            return res.status(403).json({ success: false, code: 'DRIVER_BANNED', message: 'This driver account is banned.' });
        }

        if (!driver.secretCodeResetRequested) {
            return res.status(404).json({ success: false, code: 'NO_SECRET_CODE_REQUEST', message: 'No secret code request is pending.' });
        }

        if (!driver.secretCodeSentToApp) {
            return res.status(404).json({ success: false, code: 'SECRET_CODE_NOT_SENT_TO_APP', message: 'Admin has not sent the secret code to the app yet.' });
        }

        if (!driver.secretCode) {
            return res.status(404).json({ success: false, code: 'SECRET_CODE_NOT_SET', message: 'No secret code has been set by admin yet.' });
        }

        const secretCode = String(driver.secretCode || '');
        driver.secretCodeResetRequested = false;
        driver.secretCodeResetRequestedAt = null;
        driver.secretCodeSentToApp = false;
        driver.secretCodeSentToAppAt = null;
        await driver.save();

        return res.json({
            success: true,
            code: 'SECRET_CODE_VIEWED',
            message: 'Secret code is shown one time.',
            secretCode
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// POST /api/driver/login
router.post('/login', loginByPhone);


// Driver forgot secret code request
// POST /api/driver/secret-code-reset-request
router.post('/secret-code-reset-request', async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);
        if (phone.length !== 10) {
            return res.status(400).json({ success: false, code: 'PHONE_REQUIRED', message: 'Valid 10 digit phone number required' });
        }

        const driver = await Driver.findOne({ phone });
        if (!driver) {
            return res.status(404).json({ success: false, code: 'DRIVER_NOT_REGISTERED', message: 'Driver is not registered.' });
        }

        if ((driver.approvalStatus || 'pending') === 'banned') {
            return res.status(403).json({ success: false, code: 'DRIVER_BANNED', message: 'Banned drivers cannot request a secret code reset.' });
        }

        driver.secretCodeResetRequested = true;
        driver.secretCodeResetRequestedAt = new Date();
        await driver.save();

        res.json({
            success: true,
            code: 'SECRET_CODE_RESET_REQUESTED',
            message: 'Secret code reset request has been sent to the admin panel. Admin will set or send a code.'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
});

// POST /api/driver/login-mobile
router.post('/login-mobile', loginByPhone);

// GET /api/driver/status/:phone
router.get('/status/:phone', async (req, res) => {
    try {
        const phone = normalizePhone(req.params.phone);
        const driver = await Driver.findOne({ phone });
        if (!driver) {
            return res.status(404).json({ success: false, code: 'DRIVER_NOT_REGISTERED', message: 'Driver not registered' });
        }
        res.json({
            success: true,
            approvalStatus: driver.approvalStatus || 'pending',
            adminRemark: driver.adminRemark || '',
            driver: driverPayload(driver)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
});

// GET /api/driver/profile/:phone
router.get('/profile/:phone', async (req, res) => {
    try {
        const phone = normalizePhone(req.params.phone);
        const driver = await Driver.findOne({ phone });
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }
        res.status(200).json({ success: true, message: 'Driver Profile Found', driver: driverPayload(driver) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
});


// GET /api/driver/profile-id/:driverId
router.get('/profile-id/:driverId', async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.driverId);
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }
        res.status(200).json({ success: true, message: 'Driver Profile Found', driver: driverPayload(driver) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
});



// GET /api/driver/notifications/:driverId
router.get('/notifications/:driverId', async (req, res) => {
    try {
        const DriverNotification = require('../models/DriverNotification');
        const driverId = req.params.driverId;
        const notifications = await DriverNotification.find({
            $or: [
                { target: 'all' },
                { driverId: driverId }
            ]
        }).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, count: notifications.length, notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
});

module.exports = router;
