console.log('Gemini Bridge: Content script loaded (Isolated World)');

// Logic is now running directly in the content script context, which has access to 'io' 
// because it was loaded before this script in manifest.json
initializeSocket();

function initializeSocket() {
    console.log('Gemini Bridge: Connecting to server...');
    
    // Inject Status Badge
    const updateBadge = createStatusBadge();

    // Connect to localhost directly
    const socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        console.log('Gemini Bridge: Connected to ' + socket.id);
        updateBadge('Connected', 'green');
    });

    socket.on('disconnect', () => {
        console.log('Gemini Bridge: Disconnected');
        updateBadge('Disconnected', 'red');
    });

    socket.on('connect_error', (err) => {
        console.error('Gemini Bridge: Connection error:', err);
        updateBadge('Error', 'orange');
    });

    socket.on('execute-prompt', async (data) => {
        console.log('Gemini Bridge: Received prompt:', data.prompt);
        updateBadge('Working...', 'blue');
        await runGemini(data.prompt, socket);
        updateBadge('Connected', 'green');
    });
}

function createStatusBadge() {
    const badge = document.createElement('div');
    badge.id = 'gemini-bridge-badge';
    Object.assign(badge.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '10px 15px',
        backgroundColor: '#333',
        color: '#fff',
        borderRadius: '20px',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
        zIndex: '99999',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    });

    const docIcon = document.createElement('span');
    docIcon.innerText = '🔌 ';
    badge.appendChild(docIcon);

    const textSpan = document.createElement('span');
    textSpan.innerText = 'Bridge: Init...';
    badge.appendChild(textSpan);

    document.body.appendChild(badge);

    return (status, colorName) => {
        textSpan.innerText = `Bridge: ${status}`;
        if (colorName === 'green') badge.style.backgroundColor = '#2e7d32'; // Green 800
        else if (colorName === 'red') badge.style.backgroundColor = '#c62828'; // Red 800
        else if (colorName === 'blue') badge.style.backgroundColor = '#1565c0'; // Blue 800
        else if (colorName === 'orange') badge.style.backgroundColor = '#ef6c00'; // Orange 800
        else badge.style.backgroundColor = '#333';
    };
}

async function runGemini(text, socket) {
    // 1. Find input
    const inputDiv = document.querySelector('div[contenteditable="true"]') || document.querySelector('div[role="textbox"]');
    if (!inputDiv) {
        console.error('Gemini Bridge: Input not found');
        socket.emit('gemini-response', { text: "Error: Input box not found." });
        return;
    }

    // Identify standard response containers
    // We look for common classes used by Gemini for message text
    const getResponseElements = () => {
        // .markdown is frequent for the formatted text
        // .model-response-text is sometimes used
        // fallback to any large text block in the chat area if needed
        let els = document.querySelectorAll('.markdown');
        if (els.length === 0) els = document.querySelectorAll('.model-response-text');
        if (els.length === 0) els = document.querySelectorAll('.message-content');
        return els;
    };

    const initialCount = getResponseElements().length;
    console.log(`Gemini Bridge: Initial response count: ${initialCount}`);

    // 2. Clear and set text
    inputDiv.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
    inputDiv.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait a bit for UI
    await new Promise(r => setTimeout(r, 800));

    // 3. Find and click Send
    let sendButton = document.querySelector('button[aria-label*="Send"]');
    if (!sendButton) sendButton = document.querySelector('button[aria-label*="Invia"]');
    if (!sendButton) {
        const buttons = Array.from(document.querySelectorAll('button'));
        sendButton = buttons.find(b => !b.disabled && b.querySelector('svg') && b.clientHeight > 20); 
    }

    if (sendButton) {
        sendButton.click();
        console.log('Gemini Bridge: Sent prompt');
    } else {
        console.error('Gemini Bridge: Send button not found');
        socket.emit('gemini-response', { text: "Error: Send button not found." });
        return;
    }

    // 4. Wait for response to START (element count increases)
    console.log('Gemini Bridge: Waiting for response to start...');
    let newResponseEl = null;
    let attempts = 0;
    while (attempts < 60) { // Wait up to 30s for the bubble to appear
        await new Promise(r => setTimeout(r, 500));
        const currentEls = getResponseElements();
        if (currentEls.length > initialCount) {
             newResponseEl = currentEls[currentEls.length - 1]; // The last one is the new one
             console.log('Gemini Bridge: New response element detected!');
             break;
        }
        attempts++;
    }

    if (!newResponseEl) {
        console.error('Gemini Bridge: No new response element appeared.');
        // Try to grab the last one anyway, maybe we missed the count?
        const currentEls = getResponseElements();
        if (currentEls.length > 0) {
            newResponseEl = currentEls[currentEls.length - 1];
            console.log('Gemini Bridge: Fallback to last existing element.');
        } else {
             socket.emit('gemini-response', { text: "Error: No response detected." });
             return;
        }
    }

    // 5. Wait for text stability (Response completion)
    console.log('Gemini Bridge: Waiting for text generation to finish...');
    let lastText = "";
    let stableCount = 0;
    const maxWaitTime = 180; // 3 minutes max
    
    for (let i = 0; i < maxWaitTime; i++) {
        await new Promise(r => setTimeout(r, 1000)); // Check every second
        
        let currentText = newResponseEl.innerText;
        
        // Sometimes innerText is empty while loading, ignore empty if we are early
        if (!currentText && i < 5) continue; 

        if (currentText.length > 0 && currentText === lastText) {
            stableCount++;
        } else {
            stableCount = 0;
            console.log(`Gemini Bridge: Text changing... (${currentText.length} chars)`);
        }
        
        lastText = currentText;

        // If text hasn't changed for 4 seconds, assume it's done
        if (stableCount >= 4) {
            console.log('Gemini Bridge: Response stable. Capture complete.');
            break;
        }
    }

    // Final capture
    console.log('Gemini Bridge: Sending response back (' + lastText.length + ' chars)');
    socket.emit('gemini-response', { text: lastText });
}
