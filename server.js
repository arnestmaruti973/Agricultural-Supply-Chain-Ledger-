const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public')); // Serves frontend files

// Initialize Supabase Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const PESAPAL_URL = process.env.PESAPAL_BASE_URL;

// Step 1: Authenticate and get Access Token from Pesapal
async function getPesapalToken() {
    try {
        const response = await axios.post(`${PESAPAL_URL}/api/Auth/RequestToken`, {
            consumer_key: process.env.PESAPAL_CONSUMER_KEY,
            consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
        });
        return response.data.token;
    } catch (error) {
        console.error("Token Authentication Failed:", error.response?.data || error.message);
        throw new Error("Unable to authenticate with payment gateway.");
    }
}

// Step 2: Main route to initiate checkout
app.post('/api/checkout', async (req, res) => {
    const { firstName, lastName, phoneNumber } = req.body;
    const amount = 100.00; // Fixed KSh 100 flat rate matching your design
    const merchantReference = `MEETVILLE-${Date.now()}`;

    try {
        // Save initial transaction record to Supabase
        const { error: dbError } = await supabase.from('payments').insert([
            {
                first_name: firstName,
                last_name: lastName,
                phone_number: phoneNumber,
                amount: amount,
                merchant_reference: merchantReference,
                status: 'PENDING'
            }
        ]);

        if (dbError) throw dbError;

        // Get live token
        const token = await getPesapalToken();

        // Build Payload for Pesapal Order Request
        const payload = {
            id: merchantReference,
            currency: "KES",
            amount: amount,
            description: "Meetville Premium Upgrade",
            callback_url: process.env.APP_CALLBACK_URL,
            notification_id: "00000000-0000-0000-0000-000000000000", // Optional: Replace with a registered IPN ID if configured
            billing_address: {
                phone_number: phoneNumber,
                first_name: firstName,
                last_name: lastName
            }
        };

        // Submit order to Pesapal
        const orderResponse = await axios.post(
            `${PESAPAL_URL}/api/Transactions/SubmitOrderRequest`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const { order_tracking_id, redirect_url } = orderResponse.data;

        // Update database with the Pesapal order ID
        await supabase
            .from('payments')
            .update({ pesapal_order_tracking_id: order_tracking_id })
            .eq('merchant_reference', merchantReference);

        // Send checkout URL back to front-end to safely populate the iframe
        res.json({ success: true, redirect_url: redirect_url });

    } catch (error) {
        console.error("Checkout initiation process broke down:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: "Initialization failed. Please try again." });
    }
});

// Step 3: Callback route when payment finishes inside iframe
app.get('/payment-callback', async (req, res) => {
    const { OrderTrackingId, TrackingId } = req.query;
    const targetId = OrderTrackingId || TrackingId;

    try {
        const token = await getPesapalToken();
        
        // Query Pesapal for the concrete status of the transaction
        const statusResponse = await axios.get(
            `${PESAPAL_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${targetId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const paymentStatus = statusResponse.data.payment_status_description; // COMPLETED, FAILED, etc.

        // Sync status to your database records
        await supabase
            .from('payments')
            .update({ status: paymentStatus })
            .eq('pesapal_order_tracking_id', targetId);

        // Show simplified status confirmation page to user inside the frame
        res.send(`
            <style>body{font-family:sans-serif; text-align:center; padding-top:50px; color:#333;}</style>
            <h2>Payment Status: ${paymentStatus}</h2>
            <p>You can now return to your main app window safely.</p>
        `);
    } catch (error) {
        res.status(500).send("Error verifying transaction status.");
    }
});

app.listen(3000, () => console.log('Server runtime started on port 3000'));
