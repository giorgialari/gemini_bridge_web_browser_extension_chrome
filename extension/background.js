chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'launch_server') {
        console.log('Background: Launching Native Host...');
        
        // Connect to the native host
        const port = chrome.runtime.connectNative('com.gemini.bridge.launcher');
        
        // Send start message
        port.postMessage({ action: 'start_server' });
        
        port.onMessage.addListener((msg) => {
            console.log('Background: Received from native:', msg);
        });

        port.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError) {
                console.error('Background: Native Host Disconnected Error:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                console.log('Background: Native Host Disconnected (Normal)');
            }
        });

        // We assume success if no immediate error, as the process spawns detached
        sendResponse({ success: true });
    }
    return true; // Keep channel open for async response if needed
});
