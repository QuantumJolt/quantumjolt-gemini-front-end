const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Cloud Run expects traffic on this port, which is set by the environment
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.GEMINI_API_KEY;

// Middleware to parse JSON bodies from incoming requests
app.use(express.json());

// Main chat proxy endpoint
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
    // Note: The /v1beta/ prefix is not standard but retained here for compatibility
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
app.listen(PORT, () => {
    console.log(`Cloud Run Server listening on port ${PORT}`);
});


### Your Final, Critical Steps

1.  **Paste the `server.js` code** above into your local `server.js` file.
2.  **Verify `package.json` is updated** (it should contain `express` and the `"start": "node server.js"` script).
3.  **Deploy to Google Cloud Run.** (Crucial: Set the port to **8080** and add the **`GEMINI_API_KEY`** environment variable in the Cloud Run settings).
4.  **Update `index.html`:** Get the secure URL from your Cloud Run dashboard and replace the `CHAT_ENDPOINT` in your `index.html` file.

This deployment on the Google Cloud IP range is the only coding solution that can reliably bypass the school's firewall policies.
