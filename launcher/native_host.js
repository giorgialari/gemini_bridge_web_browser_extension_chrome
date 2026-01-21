const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Logs for debugging
const logFile = path.join(__dirname, 'native_host.log');
function log(message) {
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

log('Native Host started');

// Main loop to read messages from Chrome (Length-prefixed JSON)
process.stdin.on('readable', () => {
    let chunk;
    // Chrome sends 4 bytes length (LE) + JSON string
    while (null !== (chunk = process.stdin.read(4))) {
        const length = chunk.readUInt32LE(0);
        const buffer = process.stdin.read(length);
        if (!buffer) return;
        
        const messageStr = buffer.toString('utf8');
        log(`Received: ${messageStr}`);
        
        try {
            const message = JSON.parse(messageStr);
            handleMessage(message);
        } catch (err) {
            log(`Error parsing JSON: ${err.message}`);
        }
    }
});

function handleMessage(msg) {
    if (msg.action === 'start_server') {
        startServer();
    }
}

function startServer() {
    log('Starting server...');
    const serverDir = path.join(__dirname, '..', 'server');
    
    // Spawn simple separate process for the server
    // We use 'cmd.exe' to popup a window so the user sees it running (MVP style)
    // Or we run it completely hidden? User asked to "start it locale". Seeing the window is better for now.
    
    const serverProcess = spawn('cmd.exe', ['/c', 'start', 'npm', 'start'], {
        cwd: serverDir,
        detached: true,
        stdio: 'ignore',
        windowsHide: false 
    });
    
    serverProcess.unref(); // Allow this parent to exit without waiting
    
    log('Server process spawned');
    sendMessage({ status: 'server_started' });
}

function sendMessage(msg) {
    const buffer = Buffer.from(JSON.stringify(msg));
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buffer.length, 0);
    process.stdout.write(header);
    process.stdout.write(buffer);
}
