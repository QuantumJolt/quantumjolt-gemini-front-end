// netlify/functions/gemini-proxy.js - FINAL ROBUST HANDLER

// Ensure fetch is available
const fetch = require('node-fetch');

// The main handler function Netlify calls
exports.handler = async function(event, context) {
  
  // 1. CONFIGURATION CHECK
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const targetModel = "gemini-2.5-flash"; 
  
  // Send 500 error if key is missing (internal proxy error)
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: API Key is missing from Netlify settings.' }) };
  }
  
  // Parse incoming request body
  let requestBody;
  try {
      requestBody = JSON.parse(event.body);
  } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON request from client.' }) };
  }
  
  // 2. FORWARD REQUEST TO GEMINI API
  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    // 3. CRITICAL ERROR CHECK: Check for 4xx/5xx status BEFORE parsing JSON
    if (!geminiResponse.ok) {
        // Read the error message from the API as plain text
        let errorText = await geminiResponse.text();
        
        // Return a clear, informative error back to the client
        return {
            statusCode: geminiResponse.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://ekojc.com',
            },
            body: JSON.stringify({ 
                error: `API REJECTION (${geminiResponse.status})`,
                message: errorText.substring(0, 500) // Show up to 500 chars of the error
            }),
        };
    }

    // If the request was OK (200), parse the successful JSON response
    const data = await geminiResponse.json();

    // 4. Send the successful response back to the Netlify front-end
    return {
      statusCode: 200, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://ekojc.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error('Final Fetch Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Fetch Failed: Check Netlify logs for details.' }) };
  }
};
