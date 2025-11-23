// netlify/functions/gemini-proxy.js - NETLIFY HANDLER

// We use require syntax which is reliable on Netlify
const fetch = require('node-fetch');

// The handler function Netlify calls
exports.handler = async function(event, context) {
  
  // 1. Check for the API Key stored as an Environment Variable on Netlify
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const targetModel = "gemini-2.5-flash"; 
  
  if (!GEMINI_API_KEY) {
    // Netlify function error response format
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: API Key is missing.' }) };
  }
  
  // Netlify functions receive data in event.body (which is a string)
  let requestBody;
  try {
      requestBody = JSON.parse(event.body);
  } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON request.' }) };
  }
  
  // 2. FORWARD REQUEST: Send the request to the official Google Gemini API
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

    const data = await geminiResponse.json();

    // 3. Send the response back to your Netlify front-end
    return {
      statusCode: geminiResponse.status,
      // CORS headers added for Netlify to allow cross-site communication
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://ekojc.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error('Gemini API Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to communicate with the Gemini API.' }) };
  }
};
