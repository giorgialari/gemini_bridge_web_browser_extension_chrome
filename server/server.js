const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000, // Wait 1 minute before assuming client is dead
    pingInterval: 25000
});

// Middleware for parsing JSON bodies
app.use(express.json());
app.use(cors());

// Store the socket connection
let activeSocket = null;



io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    activeSocket = socket;
    
    // Send confirmation
    socket.emit('connection-success', { status: 'connected' });

    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`);
        if (activeSocket === socket) {
            console.log('Active socket cleared.');
            activeSocket = null;
        }
    });
});

app.post('/api/ask', async (req, res) => {
    const prompt = req.body.prompt;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!activeSocket) {
        return res.status(503).json({ error: 'No active Gemini extension connection' });
    }

    console.log('Received prompt:', prompt);
    console.log('Sending to extension...');

    // Create a promise to wait for the response
    const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            // Clean up listener to avoid memory leaks if timeout happens
            activeSocket.off('gemini-response', responseHandler);
            reject(new Error('Timeout waiting for Gemini response'));
        }, 300000); // 5 minutes timeout

        const responseHandler = (data) => {
            clearTimeout(timeout);
            resolve(data);
        };

        // Emit execute-prompt to the extension
        activeSocket.emit('execute-prompt', { prompt: prompt });

        // Listen for the specific response (using once mostly works, but if we need concurrent handling we might need IDs. 
        // For MVP, simplistic "next message" approach or "once" is fine if we assume single thread)
        // Better: use .once with a unique ID if possible, but user asked for simple MVP.
        // We will use .once on the socket for the response.
        activeSocket.once('gemini-response', responseHandler);
    });

    try {
        const geminiResponse = await responsePromise;
        console.log('Received response from extension');
        return res.json({ response: geminiResponse.text });
    } catch (error) {
        console.error('Error:', error.message);
        return res.status(504).json({ error: error.message });
    }
});

const PORT = 3000;

// Increase the HTTP server's socket timeout to 5 minutes to match the API logic
server.setTimeout(300000);

server.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
    
    // Log local access URLs
    console.log(`\n--------------------------------------------------`);
    console.log(`SERVER API IS READY!`);
    console.log(`\nUse one of these URLs in n8n (HTTP Request):`);
    console.log(`\n1. If n8n is in Docker (Windows/Mac):`);
    console.log(`   http://host.docker.internal:${PORT}/api/ask`);
    console.log(`\n2. If n8n is in Docker (Linux):`);
    console.log(`   http://172.17.0.1:${PORT}/api/ask`);
    console.log(`\n3. If n8n IS NOT in Docker (Local):`);
    console.log(`   http://localhost:${PORT}/api/ask`);
    console.log(`\n(Use standard timeout settings, e.g. 5 minutes)`);
    console.log(`--------------------------------------------------\n`);
});
