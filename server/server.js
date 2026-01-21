const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware for parsing JSON bodies
app.use(express.json());
app.use(cors());

// Store the socket connection
let activeSocket = null;

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    activeSocket = socket;

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (activeSocket === socket) {
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
        }, 60000); // 60 seconds timeout

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
server.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
    
    // Attempt to start localtunnel
    try {
        const localtunnel = require('localtunnel');
        const tunnel = await localtunnel({ port: PORT });
        console.log(`\n--------------------------------------------------`);
        console.log(`PUBLIC TUNNEL URL: ${tunnel.url}`);
        console.log(`Use this URL to call the API from anywhere!`);
        console.log(`Example: POST ${tunnel.url}/api/ask`);
        console.log(`--------------------------------------------------\n`);

        tunnel.on('close', () => {
            console.log('Tunnel closed');
        });
    } catch (err) {
        console.error('Failed to start tunnel:', err.message);
    }
});
