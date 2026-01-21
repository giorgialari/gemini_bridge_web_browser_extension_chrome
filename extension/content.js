console.log('Gemini Bridge: Content script loaded (Isolated World)');

// Logic is now running directly in the content script context, which has access to 'io' 
// because it was loaded before this script in manifest.json
initializeSocket();

function initializeSocket() {
    console.log('Gemini Bridge: Connecting to server...');
    
    // Inject Status Dot
    const updateDot = createStatusDot();

    // Connect to localhost directly
    const socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        console.log('Gemini Bridge: Connected to ' + socket.id);
        updateDot('Connected', 'green');
    });

    socket.on('disconnect', () => {
        console.log('Gemini Bridge: Disconnected');
        updateDot('Disconnected', 'red');
    });

    socket.on('connect_error', (err) => {
        console.error('Gemini Bridge: Connection error:', err);
        updateDot('Error', 'orange');
    });

    socket.on('tunnel-url', (data) => {
        console.log('Gemini Bridge: Tunnel URL received:', data.url);
        window.geminiBridgeTunnelUrl = data.url;
    });

    socket.on('execute-prompt', async (data) => {
        console.log('Gemini Bridge: Received prompt:', data.prompt);
        updateDot('Working...', 'blue');
        await runGemini(data.prompt, socket);
        updateDot('Connected', 'green');
    });
}

function createStatusDot() {
    const container = document.createElement('div');
    container.id = 'gemini-bridge-ui';
    
    // 1. The Dot (Now Logo)
    const dot = document.createElement('div');
    const logoUrl = chrome.runtime.getURL('icon.png');
    
    Object.assign(dot.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '40px',
        height: '40px',
        backgroundImage: `url("${logoUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: '50%',
        zIndex: '99999',
        boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        border: '2px solid transparent',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });
    dot.title = "Gemini Bridge: Disconnected";

    // Indicator ring (for exact status)
    const ring = document.createElement('div');
    Object.assign(ring.style, {
        position: 'absolute',
        top: '-2px', left: '-2px', right: '-2px', bottom: '-2px',
        borderRadius: '50%',
        border: '2px solid #c62828', // Default red
        pointerEvents: 'none',
        transition: 'border-color 0.3s'
    });
    dot.appendChild(ring);

    // 2. The Popover (Menu)
    const popover = document.createElement('div');
    Object.assign(popover.style, {
        position: 'fixed',
        bottom: '40px',
        right: '20px',
        width: '300px',
        backgroundColor: '#1e1e1e',
        color: '#e0e0e0',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: '99998',
        display: 'none', // Hidden by default
        fontFamily: 'monospace',
        fontSize: '12px',
        border: '1px solid #333'
    });

    popover.innerHTML = `
        <div style="margin-bottom: 8px; font-weight: bold; color: #fff; border-bottom: 1px solid #333; padding-bottom: 4px;">GEMINI BRIDGE</div>
        <div style="margin-bottom: 8px;">Status: <span id="gb-status">Initializing...</span></div>
        <div style="margin-bottom: 4px; color: #aaa;">Example cURL:</div>
        <textarea id="gb-curl" readonly style="width: 100%; height: 80px; background: #2d2d2d; border: 1px solid #444; color: #4caf50; font-family: monospace; font-size: 11px; padding: 5px; box-sizing: border-box; resize: none;"></textarea>
    `;
    
    // Toggle popover on dot click
    dot.addEventListener('click', () => {
        const isVisible = popover.style.display === 'block';
        popover.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            // Update cURL when opening
            const url = window.geminiBridgeTunnelUrl || 'http://localhost:3000';
            const textarea = document.getElementById('gb-curl');
            textarea.value = `curl -X POST ${url}/api/ask \\\n-H "Content-Type: application/json" \\\n-d "{\\"prompt\\": \\"Ciao Gemini!\\"}"`;
        }
    });

    container.appendChild(popover);
    container.appendChild(dot);
    document.body.appendChild(container);

    // Close popover if clicking outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            popover.style.display = 'none';
        }
    });

    return (status, colorName) => {
        dot.title = `Gemini Bridge: ${status}`;
        const statusSpan = document.getElementById('gb-status');
        if (statusSpan) statusSpan.innerText = status;

        let colorHex = '#333';
        if (colorName === 'green') colorHex = '#00e676'; // Bright green
        else if (colorName === 'red') colorHex = '#ff1744'; // Bright red
        else if (colorName === 'blue') colorHex = '#2979ff'; // Bright blue
        else if (colorName === 'orange') colorHex = '#ff9100'; // Bright orange

        ring.style.borderColor = colorHex;
        
        // Pulse effect for working state
        if (colorName === 'blue') {
             dot.style.transform = 'scale(1.1)';
        } else {
             dot.style.transform = 'scale(1)';
        }
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
