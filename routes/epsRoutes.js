const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

const EPS_BASE_URL = process.env.EPS_BASE_URL;
const MERCHANT_ID = process.env.EPS_MERCHANT_ID;
const STORE_ID = process.env.EPS_STORE_ID;
const SECRET_KEY = process.env.EPS_SECRET_KEY;
const USERNAME = process.env.EPS_USERNAME;
const PASSWORD = process.env.EPS_PASSWORD;

/**
 * Utility to generate HMACSHA512 hash as Base64 string
 */
function generateHash(data) {
    return crypto
        .createHmac('sha512', Buffer.from(SECRET_KEY, 'utf-8'))
        .update(Buffer.from(data, 'utf-8'))
        .digest('base64');
}

/**
 * Get Bearer Token from EPS
 */
async function getEPSToken() {
    try {
        const hash = generateHash(USERNAME);
        const response = await axios.post(`${EPS_BASE_URL}Auth/GetToken`, {
            userName: USERNAME,
            password: PASSWORD
        }, {
            headers: { 'x-hash': hash }
        });

        if (response.data && response.data.token) {
            return response.data.token;
        }
        throw new Error('Failed to retrieve token: ' + JSON.stringify(response.data));
    } catch (error) {
        console.error('EPS GetToken Error:', error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * POST /eps/create-payment
 * Expected body: { amount, orderId, transactionId, customerName, customerEmail, customerPhone }
 */
router.post('/eps/create-payment', async (req, res) => {
    try {
        const { amount, orderId, transactionId, customerName, customerEmail, customerPhone } = req.body;

        if (!amount || !transactionId) {
            return res.status(400).json({ error: 'amount and transactionId are required' });
        }

        const token = await getEPSToken();
        const hash = generateHash(transactionId);

        const payload = {
            merchantId: MERCHANT_ID,
            storeId: STORE_ID,
            CustomerOrderId: orderId || `ORD-${Date.now()}`,
            merchantTransactionId: transactionId,
            totalAmount: parseFloat(amount).toFixed(2),
            transactionTypeId: 1, // 1 for Web/Browser flow
            successUrl: 'https://app.saleflats.com/eps/callback/success',
            failUrl: 'https://app.saleflats.com/eps/callback/fail',
            cancelUrl: 'https://app.saleflats.com/eps/callback/cancel',
            customerName: customerName || 'Guest User',
            customerEmail: customerEmail || 'guest@example.com',
            customerPhone: customerPhone || '01700000000',
            customerAddress: 'Dhaka, Bangladesh',
            customerCity: 'Dhaka',
            customerState: 'Dhaka',
            customerPostCode: '1200',
            customerCountry: 'Bangladesh'
        };

        const response = await axios.post(`${EPS_BASE_URL}EPSEngine/InitializeEPS`, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-hash': hash
            }
        });

        if (response.data && response.data.data && response.data.data.checkoutUrl) {
            return res.json({
                success: true,
                checkoutUrl: response.data.data.checkoutUrl,
                merchantTransactionId: transactionId
            });
        }

        res.status(500).json({ success: false, error: response.data });
    } catch (error) {
        console.error('InitializeEPS Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /eps/verify-payment
 * Expected body: { merchantTransactionId }
 */
router.post('/eps/verify-payment', async (req, res) => {
    try {
        const { merchantTransactionId } = req.body;

        if (!merchantTransactionId) {
            return res.status(400).json({ error: 'merchantTransactionId is required' });
        }

        const token = await getEPSToken();
        const hash = generateHash(merchantTransactionId);

        const response = await axios.get(`${EPS_BASE_URL}EPSEngine/CheckMerchantTransactionStatus`, {
            params: { merchantTransactionId },
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-hash': hash
            }
        });

        res.json({
            success: true,
            status: response.data.Status,
            data: response.data
        });
    } catch (error) {
        console.error('VerifyPayment Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Simple callback routes for testing
router.get('/eps/callback/success', (req, res) => res.send('Payment Successful! You can close this window.'));
router.get('/eps/callback/fail', (req, res) => res.send('Payment Failed!'));
router.get('/eps/callback/cancel', (req, res) => res.send('Payment Cancelled!'));

module.exports = router;
