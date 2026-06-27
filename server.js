const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public')); // This serves your HTML layout automatically

// Initialize Supabase Connection
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const PESAPAL_URL = "https://cyb3r.pesapal.com/pesapalv3"; // Change to https://pay.pesapal.com/pesapalv3 for Production

// Request Access Token from Pesapal
async function getPesapalToken() {
    try {
        const response = await axios.post(`${PESAPAL_URL}/api/Auth/RequestToken`, {
            consumer_key: process.env.PESAPAL_CONSUMER_KEY,
            consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
        });
        return response.data.token;
    } catch (error) {
        console.error("Pesapal Auth Error:", error.response?.data || error.message);
        throw new Error("Authentication failed");
    }
}

// Route: Initiate Payment Form Submission
app.post('/api/checkout', async (req, res) => {
    const { firstName, lastName, phoneNumber } = req.body;
    const amount = 100.00; 
    const merchantReference = `MEETVILLE-${Date.now()}`;

    try {
        // 1. Log transaction draft in Supabase
        await supabase.from('payments').insert([{
            first_name: firstName, last_name: lastName, phone_number: phoneNumber,
            amount: amount, merchant_reference: merchantReference, status: 'PENDING'
        }]);

        // 2. Fetch fresh token & post order request to Pesapal
        const token = await getPesapalToken();
        const payload = {
            id: merchantReference, currency: "KES", amount: amount,
            description: "Meetville Premium", callback_url: process.env.APP_CALLBACK_URL,
            notification_id: "00000000-0000-0000-0000-000000000000",
            billing_address: { phone_number: phoneNumber, first_name: firstName, last_name: lastName }
        };

        const orderResponse = await axios.post(`${PESAPAL_URL}/api/Transactions/SubmitOrderRequest`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const { order_tracking_id, redirect_url } = orderResponse.data;

        // 3. Update database record with structural tracking code
        await supabase.from('payments').update({ pesapal_order_tracking_id: order_tracking_id }).eq('merchant_reference', merchantReference);

        // Send payment frame link back to user frontend
        res.json({ success: true, redirect_url: redirect_url });
    } catch (error) {
        res.status(500).json({ success: false, error: "Payment initiation crashed." });
    }
});

// Route: Final verification landing page inside iframe
app.get('/payment-callback', async (req, res) => {
    const trackingId = req.query.OrderTrackingId || req.query.TrackingId;
    try {
        const token = await getPesapalToken();
        const statusResponse = await axios.get(`${PESAPAL_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const finalStatus = statusResponse.data.payment_status_description;

        await supabase.from('payments').update({ status: finalStatus }).eq('pesapal_order_tracking_id', trackingId);
        res.send(`<h3>Payment Processing Complete: ${finalStatus}</h3>`);
    } catch (e) {
        res.status(500).send("Verification processing error.");
    }
});

app.listen(3000, () => console.log('Server live on port 3000'));
