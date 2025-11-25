const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Cloud Run expects traffic on this port, which is set by the environment
// We read the PORT environment variable provided by Google Cloud.
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.GEMINI_API_KEY;

// Middleware to parse JSON bodies from incoming requests
app.use(express.json());

// --- FIX 1: Handle GET requests (Fixes the "Cannot GET /" error) ---
app.get('/', (req, res) => {
    // This route confirms the service is running and accessible.
    res.status(200).send('Gemini Proxy Server is running successfully. Use POST to access the API.');
});

// Main chat proxy endpoint (Handles the POST request from index.html)
app.post('/', async (req, res) => {
    // 1. Check for API Key
    if (!API_KEY) {
        console.error('GEMINI_API_KEY environment variable is not set in Cloud Run.');
        return res.status(500).json({ error: 'Server configuration error: API Key is missing.' });
    }

    const { prompt, history = [] } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt in request body.' });
    }

    // 2. Construct the API Payload
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

    // Map client history to the API format and add the new user prompt
    const contents = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));
    contents.push({
        role: 'user',
        parts: [{ text: prompt }]
    });

    const payload = {
        contents: contents,
        tools: [{ "google_search": {} }],
    };

    // 3. Call the Gemini API
    try {
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await geminiResponse.json();

        if (geminiResponse.ok) {
            // Success: Return the full response from Gemini back to the client
            res.status(200).json(result);
        } else {
            // Handle Gemini API errors (e.g., rate limit, bad request)
            const errorMessage = result.error?.message || 'Unknown Gemini API error';
            console.error('Gemini API returned error:', errorMessage);
            res.status(geminiResponse.status).json({ error: `Gemini API Error: ${errorMessage}` });
        }

    } catch (error) {
        // Handle network or system errors
        console.error('Cloud Run fetch error:', error);
        res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
});

// Start the server and listen on the port defined by Cloud Run
app.listen(PORT, '0.0.0.0', () => { // Explicitly listen on 0.0.0.0 for Cloud Run
    console.log(`Cloud Run Server listening on port ${PORT}`);
});
