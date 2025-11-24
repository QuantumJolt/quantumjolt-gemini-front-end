// *** CONFIGURATION ***
const PROXY_URL = "/.netlify/functions/gemini-proxy";
const MODEL_NAME = "gemini-2.5-flash"; 

let chatHistory = [];

// --- UTILITY FUNCTIONS ---

function formatMarkdown(text) {
    if (!text) return '';
    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert list items to paragraphs with minimal margin
    text = text.replace(/(\*|\-)\s+(.*)/g, '<p style="margin-left: 15px;">&bull; $2</p>');
    // Convert simple newlines to <br> 
    text = text.replace(/\n/g, '<br>'); 
    return text;
}

function displayHistory() {
    const chatOutput = document.getElementById('chatOutput');
    
    if (!chatOutput) {
        console.error("FATAL: chatOutput element missing. Check HTML structure.");
        return;
    }

    chatOutput.innerHTML = ''; 

    if (chatHistory.length === 0) {
         chatOutput.innerHTML = 'Start a conversation...';
         return;
    }

    chatHistory.forEach(message => {
        const role = message.role;
        const text = message.parts[0].text;

        const chatEntry = document.createElement('div');
        chatEntry.className = role === 'user' ? 'user-message' : 'model-message';
        
        let formattedText = formatMarkdown(text);
        
        chatEntry.innerHTML = `
            <span class="message-role ${role}-role">${role === 'user' ? 'You' : 'Gemini'}</span>
            <div>${formattedText}</div>
        `;
        
        chatOutput.appendChild(chatEntry);
    });
    chatOutput.scrollTop = chatOutput.scrollHeight; 
}

// --- GLOBAL FUNCTIONS (Called by onclick events) ---

window.startNewChat = function() {
    chatHistory = []; 
    const promptInput = document.getElementById('promptInput');
    if (promptInput) {
        promptInput.value = '';
    }
    displayHistory();
    console.log("Chat history cleared. New session started.");
}

window.copyChatText = function() {
    if (chatHistory.length === 0) {
        console.log("The chat is empty!");
        return;
    }
    
    let textToCopy = "--- Gemini Chat Transcript ---\n\n";
    chatHistory.forEach(message => {
        const role = message.role === 'user' ? 'You' : 'Gemini';
        const content = message.parts[0].text;
        textToCopy += `${role}: ${content}\n\n`;
    });
    textToCopy += "--------------------------------\n";

    try {
        const tempInput = document.createElement('textarea');
        tempInput.value = textToCopy;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        console.log("Chat copied to clipboard!");
    } catch (err) {
        console.error('Could not copy text: ', err);
    }
}

window.sendMessage = async function() {
    const promptInput = document.getElementById('promptInput');
    const userPrompt = promptInput.value.trim();
    const chatOutput = document.getElementById('chatOutput');

    if (!userPrompt || !promptInput) return; 

    const userMessage = { role: "user", parts: [{ text: userPrompt }] };
    chatHistory.push(userMessage);

    promptInput.value = '';
    displayHistory();
    
    // Append a temporary thinking indicator to the last message
    if (chatOutput && chatOutput.lastChild) {
        const lastChildDiv = chatOutput.lastChild.querySelector('div');
        if (lastChildDiv) {
            lastChildDiv.innerHTML = lastChildDiv.innerHTML.replace('...thinking', '');
            lastChildDiv.innerHTML += '...thinking';
        }
    }

    try {
        const requestBody = {
            contents: chatHistory, 
            model: MODEL_NAME 
        };

        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (response.status === 204) {
            throw new Error("Proxy returned 204 No Content (likely preflight error).");
        }

        const data = await response.json();
        let geminiMessageText = '';

        if (response.ok && data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            geminiMessageText = data.candidates[0].content.parts[0].text;
        } 
        else if (data.error || data.message) {
            geminiMessageText = `Error from Proxy Server: ${data.error ? (data.error.message || data.error) : data.message}`;
        }
        else {
            geminiMessageText = `Error from Proxy Server: ${response.statusText || 'Unknown Error'}`;
        }
        
        const geminiMessage = { role: "model", parts: [{ text: geminiMessageText }] };
        chatHistory.push(geminiMessage);

    } catch (error) {
        console.error("Fetch/Network Error:", error);
        chatHistory.push({ role: "model", parts: [{ text: `Network Error: Could not reach the server. Details: ${error.message}` }] });
    }
    
    displayHistory(); 
}

// --- INITIALIZATION ---
// 1. Attach keyboard listener (must run after DOM is available)
document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('promptInput');
    if (inputField) {
        inputField.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                window.sendMessage();      
            }
        });
    }
});

// 2. INITIALIZE DISPLAY (Relies on script placement at end of <body>)
displayHistory();
