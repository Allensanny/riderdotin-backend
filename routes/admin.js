const express = require('express');
const path = require('path');
const Driver = require('../models/Driver');
const AdminLog = require('../models/AdminLog');
const DriverNotification = require('../models/DriverNotification');

const router = express.Router();

function adminUser() {
    return process.env.ADMIN_USER || 'admin';
}

function adminPassword() {
    return process.env.ADMIN_PASSWORD || 'admin123';
}

function readAdminUser(req) {
    return req.headers['x-admin-user'] || req.body.adminUser || req.query.adminUser;
}

function readAdminPassword(req) {
    return req.headers['x-admin-password'] || req.body.adminPassword || req.query.adminPassword;
}

function checkAdmin(req, res, next) {
    const user = String(readAdminUser(req) || '').trim();
    const pass = String(readAdminPassword(req) || '');

    if (user !== adminUser() || pass !== adminPassword()) {
        return res.status(401).json({ success: false, message: 'Invalid admin user ID or password' });
    }
    req.adminUser = user;
    next();
}

function fileUrl(req, file) {
    if (!file) return '';
    return `${req.protocol}://${req.get('host')}/uploads/driver-documents/${file.filename}`;
}

function serialize(driver) {
    const coords = driver.location && Array.isArray(driver.location.coordinates) ? driver.location.coordinates : [0, 0];
    const lng = Number(coords[0] || 0);
    const lat = Number(coords[1] || 0);

    return {
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        address: driver.address || '',
        email: driver.email || '',
        age: driver.age || null,
        vehicleNumber: driver.vehicleNumber,
        vehicleType: driver.vehicleType,
        city: driver.city,
        state: driver.state || 'West Bengal',
        approvalStatus: driver.approvalStatus || 'pending',
        adminRemark: driver.adminRemark || '',
        banReason: driver.banReason || '',
        isOnline: !!driver.isOnline,
        status: driver.status,
        documents: driver.documents || {},
        location: driver.location || { type: 'Point', coordinates: [0, 0] },
        latitude: lat,
        longitude: lng,
        hasLocation: !!(lat && lng),
        lastLocationAt: driver.lastLocationAt || null,
        createdAt: driver.createdAt,
        approvedAt: driver.approvedAt,
        rejectedAt: driver.rejectedAt,
        bannedAt: driver.bannedAt,
        secretCodeSet: !!driver.secretCode,
        secretCodeMasked: driver.secretCode ? ('••••' + String(driver.secretCode).slice(-2)) : '',
        secretCodeResetRequested: !!driver.secretCodeResetRequested,
        secretCodeResetRequestedAt: driver.secretCodeResetRequestedAt || null,
        secretCodeUpdatedAt: driver.secretCodeUpdatedAt || null,
        secretCodeLastSentAt: driver.secretCodeLastSentAt || null,
        secretCodeSentToApp: !!driver.secretCodeSentToApp,
        secretCodeSentToAppAt: driver.secretCodeSentToAppAt || null
    };
}

function cleanString(v) {
    return String(v == null ? '' : v).trim();
}

function generateSecretCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeSecretCode(v) {
    return String(v == null ? '' : v).trim();
}

function normalizePhone(v) {
    let digits = String(v || '').replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) digits = digits.substring(2);
    if (digits.length > 10) digits = digits.substring(digits.length - 10);
    return digits;
}

function buildSecretCodeMessage(driver, secretCode) {
    const name = driver && driver.name ? driver.name : 'Rider';
    return `Hi ${name}, your RideDotIn Captain secret login code is: ${secretCode}. Please do not share this code with anyone.`;
}

function whatsappLink(phone, message) {
    const digits = normalizePhone(phone);
    const fullPhone = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}

function smsLink(phone, message) {
    const digits = normalizePhone(phone);
    return `sms:${digits}?body=${encodeURIComponent(message)}`;
}


async function addLog(req, action, driver, details, meta = {}) {
    try {
        await AdminLog.create({
            adminUser: req.adminUser || 'admin',
            action,
            driverId: driver && driver._id ? driver._id : null,
            driverName: driver && driver.name ? driver.name : '',
            driverPhone: driver && driver.phone ? driver.phone : '',
            details: details || '',
            meta
        });
    } catch (e) {
        console.log('Admin log error:', e.message);
    }
}


function buildUpdate(body) {
    const update = {};
    const stringFields = ['name', 'address', 'email', 'vehicleNumber', 'vehicleType', 'city', 'state', 'adminRemark', 'banReason'];
    stringFields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(body, field)) update[field] = cleanString(body[field]);
    });
    if (Object.prototype.hasOwnProperty.call(body, 'age')) {
        const age = parseInt(body.age, 10);
        update.age = Number.isNaN(age) ? null : age;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'approvalStatus')) {
        const st = cleanString(body.approvalStatus).toLowerCase();
        if (['pending', 'approved', 'rejected', 'banned'].includes(st)) update.approvalStatus = st;
    }
    const docs = body.documents || {};
    if (docs.rc && Object.prototype.hasOwnProperty.call(docs.rc, 'number')) update['documents.rc.number'] = cleanString(docs.rc.number).toUpperCase();
    if (docs.pan && Object.prototype.hasOwnProperty.call(docs.pan, 'number')) update['documents.pan.number'] = cleanString(docs.pan.number).toUpperCase();
    if (docs.aadhaar && Object.prototype.hasOwnProperty.call(docs.aadhaar, 'number')) update['documents.aadhaar.number'] = cleanString(docs.aadhaar.number);
    if (docs.dl && Object.prototype.hasOwnProperty.call(docs.dl, 'number')) update['documents.dl.number'] = cleanString(docs.dl.number).toUpperCase();
    return update;
}

router.get('/config', checkAdmin, (req, res) => {
    res.json({
        success: true,
        adminUser: adminUser(),
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
});

router.get('/drivers', checkAdmin, async (req, res) => {
    try {
        const status = req.query.status || 'pending';
        const search = cleanString(req.query.search);
        const query = status === 'all'
            ? {}
            : status === 'pending'
                ? { $or: [{ approvalStatus: 'pending' }, { approvalStatus: { $exists: false } }, { approvalStatus: null }] }
                : { approvalStatus: status };

        if (search) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { name: new RegExp(search, 'i') },
                    { phone: new RegExp(search, 'i') },
                    { vehicleNumber: new RegExp(search, 'i') },
                    { city: new RegExp(search, 'i') },
                    { email: new RegExp(search, 'i') }
                ]
            });
        }

        const drivers = await Driver.find(query).sort({ createdAt: -1 }).limit(500);
        res.json({ success: true, count: drivers.length, drivers: drivers.map(serialize) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/live-drivers', checkAdmin, async (req, res) => {
    try {
        const drivers = await Driver.find({ approvalStatus: 'approved' }).sort({ isOnline: -1, lastLocationAt: -1, name: 1 }).limit(1000);
        const serialized = drivers.map(serialize);
        const online = serialized.filter(d => d.isOnline);
        res.json({
            success: true,
            totalApproved: serialized.length,
            totalOnline: online.length,
            totalWithLocation: serialized.filter(d => d.hasLocation).length,
            updatedEverySeconds: 3,
            drivers: serialized
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


router.get('/logs', checkAdmin, async (req, res) => {
    try {
        const logs = await AdminLog.find({}).sort({ createdAt: -1 }).limit(300);
        res.json({ success: true, count: logs.length, logs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/notification', checkAdmin, async (req, res) => {
    try {
        const title = cleanString(req.body.title || 'RideDotIn Notification');
        const message = cleanString(req.body.message || '');
        const driverId = cleanString(req.body.driverId || '');
        if (!message) return res.status(400).json({ success: false, message: 'Notification message required' });

        const notification = await DriverNotification.create({
            title,
            message,
            target: driverId ? 'driver' : 'all',
            driverId: driverId || null,
            sentBy: req.adminUser || 'admin'
        });

        await addLog(req, 'SEND_NOTIFICATION', null, driverId ? `Notification sent to driver ${driverId}: ${title}` : `Notification sent to all riders: ${title}`, { title, message, driverId });

        res.json({ success: true, message: 'Notification sent successfully', notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/notifications', checkAdmin, async (req, res) => {
    try {
        const notifications = await DriverNotification.find({}).sort({ createdAt: -1 }).limit(200);
        res.json({ success: true, count: notifications.length, notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


router.get('/driver/:id', checkAdmin, async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
        res.json({ success: true, driver: serialize(driver) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/driver/:id', checkAdmin, async (req, res) => {
    try {
        const update = buildUpdate(req.body || {});
        if (update.approvalStatus === 'approved') {
            update.approvedAt = new Date();
            update.rejectedAt = null;
            update.isOnline = false;
            update.status = 'offline';
        }
        if (update.approvalStatus === 'rejected') {
            update.rejectedAt = new Date();
            update.approvedAt = null;
            update.isOnline = false;
            update.status = 'offline';
        }
        if (update.approvalStatus === 'banned') {
            update.bannedAt = new Date();
            update.isOnline = false;
            update.status = 'offline';
            update.socketId = '';
            update.banReason = update.banReason || update.adminRemark || 'Banned by admin';
        }
        if (update.approvalStatus === 'pending') {
            update.approvedAt = null;
            update.rejectedAt = null;
            update.isOnline = false;
            update.status = 'offline';
        }

        const driver = await Driver.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
        await addLog(req, 'EDIT_DRIVER', driver, 'Driver details/documents numbers updated', { update });
        res.json({ success: true, message: 'Driver details updated', driver: serialize(driver) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/driver/:id/document/:type', checkAdmin, (req, res) => {
    const type = cleanString(req.params.type).toLowerCase();
    if (!['aadhaar', 'pan', 'rc', 'dl'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid document type' });
    }

    const upload = req.app.get('driverDocumentsUpload');
    if (!upload) {
        return res.status(500).json({ success: false, message: 'Upload middleware not configured' });
    }

    upload.single('documentFile')(req, res, async (err) => {
        if (err) {
            let message = err.message || 'File upload error';
            if (err.code === 'LIMIT_FILE_SIZE') message = 'File too large. Each document must be smaller than 25MB.';
            return res.status(400).json({ success: false, code: err.code || 'UPLOAD_ERROR', message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Please choose a document file' });
            }

            const number = cleanString(req.body.documentNumber || req.body.number || '');
            const update = {
                [`documents.${type}.fileUrl`]: fileUrl(req, req.file),
                [`documents.${type}.originalName`]: req.file.originalname
            };
            if (number) update[`documents.${type}.number`] = type === 'aadhaar' ? number : number.toUpperCase();

            const driver = await Driver.findByIdAndUpdate(req.params.id, update, { new: true });
            if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

            await addLog(req, 'UPLOAD_DOCUMENT', driver, `${type.toUpperCase()} document uploaded/replaced`, { type, originalName: req.file.originalname });
            res.json({ success: true, message: `${type.toUpperCase()} document uploaded`, driver: serialize(driver) });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
});

router.post('/driver/:id/approve', checkAdmin, async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(req.params.id, {
            approvalStatus: 'approved',
            adminRemark: req.body.remark || 'Approved',
            approvedAt: new Date(),
            rejectedAt: null,
            isOnline: false,
            status: 'offline'
        }, { new: true });

        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
        await addLog(req, 'APPROVE_DRIVER', driver, 'Driver approved', { remark: req.body.remark || 'Approved' });
        res.json({ success: true, message: 'Driver approved successfully', driver: serialize(driver) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/driver/:id/reject', checkAdmin, async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(req.params.id, {
            approvalStatus: 'rejected',
            adminRemark: req.body.remark || 'Documents not verified',
            rejectedAt: new Date(),
            approvedAt: null,
            isOnline: false,
            status: 'offline'
        }, { new: true });

        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
        await addLog(req, 'REJECT_DRIVER', driver, 'Driver rejected', { remark: req.body.remark || 'Documents not verified' });
        res.json({ success: true, message: 'Driver rejected', driver: serialize(driver) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


router.post('/driver/:id/ban', checkAdmin, async (req, res) => {
    try {
        const reason = cleanString(req.body.reason || req.body.remark || 'Banned by admin');
        const driver = await Driver.findByIdAndUpdate(req.params.id, {
            approvalStatus: 'banned',
            banReason: reason,
            adminRemark: reason,
            bannedAt: new Date(),
            isOnline: false,
            status: 'offline',
            socketId: ''
        }, { new: true });

        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
        await addLog(req, 'BAN_DRIVER', driver, 'Driver banned', { reason });
        res.json({ success: true, message: 'Driver banned successfully', driver: serialize(driver) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/driver/:id/unban', checkAdmin, async (req, res) => {
    try {
        const remark = cleanString(req.body.remark || 'Unbanned by admin');
        const driver = await Driver.findByIdAndUpdate(req.params.id, {
            approvalStatus: 'approved',
            banReason: '',
            adminRemark: remark,
            approvedAt: new Date(),
            bannedAt: null,
            isOnline: false,
            status: 'offline',
            socketId: ''
        }, { new: true });

        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
        await addLog(req, 'UNBAN_DRIVER', driver, 'Driver unbanned and approved', { remark });
        res.json({ success: true, message: 'Driver unbanned successfully', driver: serialize(driver) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});



router.post('/driver/:id/secret-code', checkAdmin, async (req, res) => {
    try {
        let secretCode = normalizeSecretCode(req.body.secretCode || req.body.code);
        if (!secretCode) secretCode = generateSecretCode();

        if (secretCode.length < 4 || secretCode.length > 12) {
            return res.status(400).json({ success: false, message: 'Secret code must be 4 to 12 characters long.' });
        }

        const driver = await Driver.findByIdAndUpdate(req.params.id, {
            secretCode,
            secretCodeResetRequested: false,
            secretCodeResetRequestedAt: null,
            secretCodeUpdatedAt: new Date()
        }, { new: true });

        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

        await addLog(req, 'SET_SECRET_CODE', driver, 'Driver secret code set or reset by admin', { secretCodeLength: secretCode.length });
        res.json({
            success: true,
            message: 'Secret code set successfully.',
            secretCode,
            driver: serialize(driver)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


router.post('/driver/:id/secret-code/send', checkAdmin, async (req, res) => {
    try {
        const generateNew = !!req.body.generateNew;
        const driver = await Driver.findById(req.params.id);
        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

        if (generateNew || !driver.secretCode) {
            driver.secretCode = generateSecretCode();
            driver.secretCodeUpdatedAt = new Date();
        }

        const secretCode = String(driver.secretCode || '').trim();
        if (!secretCode) {
            return res.status(400).json({ success: false, message: 'Secret code is not set. Please set or reset the code first.' });
        }

        const message = buildSecretCodeMessage(driver, secretCode);
        const notification = await DriverNotification.create({
            title: 'RideDotIn Secret Code',
            message,
            target: 'driver',
            driverId: driver._id,
            sentBy: req.adminUser || 'admin'
        });

        driver.secretCodeSentToApp = true;
        driver.secretCodeSentToAppAt = new Date();
        driver.secretCodeLastSentAt = new Date();
        // Keep secretCodeResetRequested true until the driver views the code once in the app.
        await driver.save();

        await addLog(req, 'SEND_SECRET_CODE', driver, 'Secret code sent to driver', {
            phone: driver.phone,
            generatedNew: generateNew,
            notificationId: notification._id
        });

        res.json({
            success: true,
            message: req.body.appOnly ? 'Secret code sent to driver app notification.' : 'Secret code is ready to send. WhatsApp/SMS link is ready.',
            secretCode,
            driver: serialize(driver),
            notification,
            sendText: message,
            phone: driver.phone,
            whatsappUrl: whatsappLink(driver.phone, message),
            smsUrl: smsLink(driver.phone, message)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


router.post('/driver/:id/secret-code/clear-request', checkAdmin, async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(req.params.id, {
            secretCodeResetRequested: false,
            secretCodeResetRequestedAt: null
        }, { new: true });

        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

        await addLog(req, 'CLEAR_SECRET_CODE_REQUEST', driver, 'Secret code reset request cleared');
        res.json({ success: true, message: 'Reset request cleared.', driver: serialize(driver) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


router.delete('/driver/:id', checkAdmin, async (req, res) => {
    try {
        const driver = await Driver.findByIdAndDelete(req.params.id);
        if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
        await addLog(req, 'DELETE_DRIVER', driver, 'Driver deleted permanently');
        res.json({ success: true, message: 'Driver deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
