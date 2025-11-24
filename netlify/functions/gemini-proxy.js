/**
 * Netlify Function to securely proxy requests to the Gemini API.
 * This hides the API key from the client and handles the request/response
 * formatting for the model.
 *
 * The GEMINI_API_KEY is read automatically from the Netlify environment variables.
 */

// Use commonjs require syntax for Node.js Netlify functions
const fetch = require('node-fetch');

// The main handler for the Netlify Function
exports.handler = async (event, context) => {
    // Ensure only POST requests are allowed
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 1. Retrieve API Key from Netlify environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY environment variable is not set.');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: API Key is missing.' })
        };
    }

    let data;
    try {
        // 2. Parse the request body from the client
        data = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
    }

    const { prompt, history = [] } = data; // Expecting current prompt and history array

    if (!prompt) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing prompt in request body.' }) };
    }

    // 3. Construct the API Payload
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    // Map client history to the API format and add the new user prompt
    const contents = history.map(msg => ({
        // Ensure roles are correctly mapped: 'user' or 'model'
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
    }));
    contents.push({
        role: 'user',
        parts: [{ text: prompt }]
    });

    const payload = {
        contents: contents,
        // Optional: Add Google Search tool for grounded, up-to-date responses
        tools: [{ "google_search": {} }],
    };

    // 4. Call the Gemini API
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            // Success: Return the full response from Gemini
            return {
                statusCode: 200,
                body: JSON.stringify(result)
            };
        } else {
            // Handle Gemini API errors (e.g., bad request, rate limit)
            const errorMessage = result.error?.message || 'Unknown Gemini API error';
            console.error('Gemini API returned error:', errorMessage);
            return {
                statusCode: result.error?.code || 500,
                body: JSON.stringify({ error: `Gemini API Error: ${errorMessage}` })
            };
        }

    } catch (error) {
        // Handle network or system errors
        console.error('Function execution or fetch error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Internal Server Error: ${error.message}` })
        };
    }
};
