console.log('Gemini Bridge: Content script loaded (Isolated World)');

// Logic is now running directly in the content script context, which has access to 'io' 
// because it was loaded before this script in manifest.json
initializeSocket();

function initializeSocket() {
    console.log('Gemini Bridge: Connecting to server...');
    
    // Inject Status Dot
    const updateDot = createStatusDot();

    // Connect to localhost (127.0.0.1 is often more reliable for avoiding DNS issues)
    const socket = io('http://127.0.0.1:3000', {
        reconnectionAttempts: 20,
        reconnectionDelay: 2000,
        timeout: 20000 
    });
    
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
    const logoUrl = chrome.runtime.getURL('gemini_icon.png');
    
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
        <div style="margin-bottom: 8px; font-weight: bold; color: #fff; border-bottom: 1px solid #333; padding-bottom: 4px; display: flex; justify-content: space-between;">
            <span>GEMINI BRIDGE</span>
            <span style="font-size: 10px; opacity: 0.7; cursor: pointer;" id="gb-toggle-help">❓ Help</span>
        </div>
        
        <div style="margin-bottom: 8px;">Status: <span id="gb-status">Initializing...</span></div>
        
        <button id="gb-start-server" style="width:100%; margin-bottom: 8px; padding: 6px; background: #2979ff; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: bold;">▶ Start/Restart Server</button>
        
        <!-- Setup Guide (Hidden by default) -->
        <div id="gb-help-section" style="display:none; background: #333; padding: 8px; margin-bottom: 8px; border-radius: 4px; font-size: 11px; line-height: 1.4;">
            <strong style="color: #ff9100;">First Time Setup:</strong><br>
            1. Download the <a href="https://github.com/giorgialari/gemini_bridge_web_browser_extension_chrome" target="_blank" style="color: #4fc3f7; text-decoration: underline;">Project (Server + Launcher)</a> from GitHub.<br>
            2. Run <code>install.bat</code>.<br>
            3. Paste Extension ID: <br>
            <code style="background:black; padding:2px; display:block; margin:2px 0;">${chrome.runtime.id}</code>
            4. Reload extension & Refresh page.
        </div>

        <div style="margin-bottom: 4px; color: #aaa;">PRONTI ALL'USO (cURL):</div>
        <textarea id="gb-curl" readonly style="width: 100%; height: 80px; background: #2d2d2d; border: 1px solid #444; color: #4caf50; font-family: monospace; font-size: 11px; padding: 5px; box-sizing: border-box; resize: none;"></textarea>
    `;
    
    // Toggle popover on dot click
    dot.addEventListener('click', () => {
        const isVisible = popover.style.display === 'block';
        popover.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            // Bind Help Toggle
            const helpBtn = document.getElementById('gb-toggle-help');
            const helpSec = document.getElementById('gb-help-section');
            if(helpBtn) helpBtn.onclick = (e) => {
                e.stopPropagation();
                helpSec.style.display = helpSec.style.display === 'none' ? 'block' : 'none';
            };

            // Update cURL when opening
            const url = window.geminiBridgeTunnelUrl || 'http://localhost:3000';
            const textarea = document.getElementById('gb-curl');
            textarea.value = `curl -X POST ${url}/api/ask \\\n-H "Content-Type: application/json" \\\n-d "{\\"prompt\\": \\"Ciao Gemini!\\"}"`;
            
            setTimeout(() => {
                const btn = document.getElementById('gb-start-server');
                if(btn) btn.onclick = () => {
                    try {
                        chrome.runtime.sendMessage({ action: 'launch_server' }, (response) => {
                             if (chrome.runtime.lastError) {
                                 alert('Error: ' + chrome.runtime.lastError.message + '\n\nDid you reload the extension?');
                                 return;
                             }
                             if (!response) {
                                 alert('Error: No response from extension.\nPlease reload the extension in chrome://extensions');
                                 return;
                             }
                             if(response && response.error) alert('Error: ' + response.error);
                             else alert('Server launch command sent!');
                        });
                    } catch (e) {
                         alert('Connection Error: ' + e.message + '\nPlease reload the page and extension.');
                    }
                };
            }, 50);
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
    console.log('Gemini Bridge: === START runGemini ===');
    
    // 1. Find input
    const inputDiv = document.querySelector('div[contenteditable="true"]') || document.querySelector('div[role="textbox"]');
    if (!inputDiv) {
        console.error('Gemini Bridge: Input not found');
        socket.emit('gemini-response', { text: "Error: Input box not found." });
        return;
    }

    // 2. Capture state BEFORE sending
    const conversationArea = document.querySelector('main') || document.body;
    const initialTextContent = conversationArea.innerText; // Store full text
    
    // Helper for finding messages
    const getModelMessages = () => document.querySelectorAll('[data-message-author-role="model"], .model-response-text, .markdown');
    
    console.log('Gemini Bridge: Initial Text Length:', initialTextContent.length);

    // 3. Insert and Send
    inputDiv.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
    
    // FORCE UI WAKEUP
    inputDiv.dispatchEvent(new Event('input', { bubbles: true }));
    inputDiv.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', charCode: 32, keyCode: 32, bubbles: true }));
    inputDiv.dispatchEvent(new KeyboardEvent('keyup',  { key: ' ', code: 'Space', charCode: 32, keyCode: 32, bubbles: true }));
    inputDiv.dispatchEvent(new Event('change', { bubbles: true }));
    
    await new Promise(r => setTimeout(r, 2000)); 

    // Robust Send Strategy
    const getSendButton = () => {
        // High specificity first
        return document.querySelector('button[aria-label="Invia"]') || 
               document.querySelector('button[aria-label="Send"]') ||
               document.querySelector('button[aria-label="Submit"]') ||
               // Icon based
               Array.from(document.querySelectorAll('button')).find(b => {
                   if (b.disabled) return false;
                   const svg = b.querySelector('svg');
                   const hasSendIcon = b.innerHTML.includes('send') || (svg && b.clientHeight > 30);
                   return hasSendIcon;
               });
    };

    let sendButton = getSendButton();

    // Helper for complex clicking
    const simulateClick = (element) => {
        const opts = { bubbles: true, cancelable: true, view: window };
        element.dispatchEvent(new MouseEvent('mousedown', opts));
        element.dispatchEvent(new MouseEvent('mouseup', opts));
        element.click();
    };
    
    let sent = false;

    if (sendButton) {
        console.log('Gemini Bridge: Clicking Send Button', sendButton);
        // Log attributes to be sure
        const attrStr = Array.from(sendButton.attributes).map(a => `${a.name}="${a.value}"`).join(' ');
        console.log('Gemini Bridge: Button debug:', `<button ${attrStr}>`);

        if (sendButton.disabled) {
             console.warn('Gemini Bridge: Button is DISABLED. Attempting to wake input again...');
             inputDiv.focus();
             document.execCommand('insertText', false, ' ');
             await new Promise(r => setTimeout(r, 500));
        }
        
        simulateClick(sendButton);
        
        // Validation: Verify input is cleared
        await new Promise(r => setTimeout(r, 1000));
        if (inputDiv.innerText.trim().length === 0) {
            sent = true;
            console.log('Gemini Bridge: Sent confirmed (Input cleared).');
        } else {
             console.warn('Gemini Bridge: not sent, trying double-tap and hard click...');
             simulateClick(sendButton);
        }
    } else {
         console.warn('Gemini Bridge: Send button NOT FOUND');
    }

    if (!sent && inputDiv.innerText.trim().length > 0) {
        console.warn('Gemini Bridge: Fallback to ENTER key...');
        const mkEvent = (type) => new KeyboardEvent(type, {
            bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter', which: 13
        });
        inputDiv.dispatchEvent(mkEvent('keydown'));
        inputDiv.dispatchEvent(mkEvent('keypress'));
        inputDiv.dispatchEvent(mkEvent('keyup'));
    }

    // 4. WAIT FOR GENERATION TO START (Max 120s)
    console.log('Gemini Bridge: Waiting for generation to start (max 120s)...');
    
    let generationDetected = false;
    let responseEl = null;
    
    const getStopButton = () => document.querySelector('button[aria-label*="Stop"]') || 
                               document.querySelector('button[aria-label*="Interrompi"]');

    for (let i = 0; i < 240; i++) { // 240 * 500ms = 120s
        await new Promise(r => setTimeout(r, 500));
        
        // Signal A: Stop Button Visible
        if (getStopButton()) {
            console.log('Gemini Bridge: Signal (Stop Button)');
            generationDetected = true;
            break;
        }
        
        // Signal B: New Unique Message
        const currentMsgs = getModelMessages();
        if (currentMsgs.length > 0) {
             const candidateMsg = currentMsgs[currentMsgs.length - 1];
             const candidateText = candidateMsg.innerText;
             
             if (candidateText.length > 20 && !initialTextContent.includes(candidateText.substring(0, 50))) {
                 console.log('Gemini Bridge: Signal (New Unique Message)');
                 generationDetected = true;
                 responseEl = candidateMsg;
                 break;
             }
        }
        
        // Signal C: Significant Text Increase (Must be MORE than the prompt)
        const currentText = conversationArea.innerText;
        // Logic: Current text must be Initial + Prompt + New Stuff. 
        // We use a safe margin.
        if (currentText.length > initialTextContent.length + text.length + 50) {
            console.log('Gemini Bridge: Signal (Text Increased significantly)');
            generationDetected = true;
            break;
        }
    }
    
    if (!generationDetected) {
        socket.emit('gemini-response', { text: "Error: Timed out. AI did not start responding within 120s." });
        return;
    }

    // 5. MONITOR PROGRESS until finished
    console.log('Gemini Bridge: Monitoring generation...');
    
    let stableCount = 0;
    let lastTextLen = 0;
    
    for (let i = 0; i < 600; i++) { // Max 5 mins
        await new Promise(r => setTimeout(r, 1000));
        
        if (getStopButton()) {
            stableCount = 0;
            continue;
        }
        
        const currentText = conversationArea.innerText;
        
        // Only count as stable if text has actually increased from start
        if (currentText.length > initialTextContent.length + 20) {
             if (currentText.length === lastTextLen) {
                stableCount++;
                console.log(`Gemini Bridge: Stable ${stableCount}/10`);
             } else {
                stableCount = 0;
                lastTextLen = currentText.length;
             }
        } else {
            stableCount = 0;
        }
        
        if (stableCount >= 10) break;
    }

    // 6. CAPTURE FINAL RESPONSE
    const finalMsgs = getModelMessages();
    // Try to find the element again
    if (finalMsgs.length > 0 && (!responseEl || !document.contains(responseEl))) {
         // Find the last fresh one
         for (let i = finalMsgs.length - 1; i >= 0; i--) {
             const m = finalMsgs[i];
             if (!initialTextContent.includes(m.innerText.substring(0, 50))) {
                 responseEl = m;
                 break;
             }
         }
    }
    
    let responseText = "";
    
    // STRATEGY 1: Extract Code Block (Best for JSON)
    if (responseEl) {
        const codeBlocks = responseEl.querySelectorAll('pre, code, .code-block');
        if (codeBlocks.length > 0) {
            // Join all code blocks (sometimes it splits)
            responseText = Array.from(codeBlocks).map(cb => cb.innerText).join('\n');
            console.log('Gemini Bridge: Extracted from Code Block');
        } else {
            responseText = responseEl.innerText;
            console.log('Gemini Bridge: Captured via Element Text');
        }
    }
    
    // STRATEGY 2: Text Diff Fallback
    if (!responseText || initialTextContent.includes(responseText.substring(0, 50))) {
        console.warn('Gemini Bridge: Using Text Diff Fallback');
        const allText = conversationArea.innerText;
        const promptSnippet = text.length > 50 ? text.substring(0, 50) : text;
        const promptIdx = allText.lastIndexOf(promptSnippet);
        
        if (promptIdx > -1) {
             responseText = allText.substring(promptIdx + text.length).trim();
        } else {
             // Fallback: Slice difference
             const diffLen = allText.length - initialTextContent.length;
             if (diffLen > 0) {
                 responseText = allText.slice(-diffLen); 
             } else {
                 responseText = allText.slice(-2000); 
             }
        }
    }

    // CLEANUP & JSON EXTRACTION
    // If we suspect it's JSON, try to extract just the JSON part
    if (responseText.includes('[') || responseText.includes('{')) {
        const jsonMatch = responseText.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
            console.log('Gemini Bridge: JSON Pattern Detected, extracting...');
            responseText = jsonMatch[0];
        }
    }

    // Remove UI noise just in case
    const uiPatterns = [
        /Gemini può fare errori.*$/s,
        /La tua privacy e Gemini.*$/s,
        /Strumenti\s*Pro.*$/gs,
        /^Q\s*$/gm,
        /Hai interrotto la risposta/g,
        /Chiedi a Gemini.*$/gm,
        /\nStrumenti\nVeloce/g,
        /Gem personalizzato\nJSON/g
    ];
    for (const pattern of uiPatterns) {
        responseText = responseText.replace(pattern, '').trim();
    }
    
    console.log('Gemini Bridge: Sending response (' + responseText.length + ' chars)');
    
    if (responseText.length < 10) {
        socket.emit('gemini-response', { text: "Error: Captured response was empty/too short." });
        return;
    }

    socket.emit('gemini-response', { text: responseText });
}
