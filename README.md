# 🌉 Gemini Bridge

> **The Missing Link:** Control your active Google Gemini web session programmatically via a simple REST API.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4-blue)](https://socket.io/)

**Gemini Bridge** is a powerful toolset that connects a local Node.js server to a Chrome Extension running on `gemini.google.com`. It effectively turns the Gemini web interface into a controllable API endpoint, allowing you to integrate Gemini's reasoning capabilities into your own workflows, scripts, or automations without waiting for official API quotas.

---

## ✨ Features

- **🚀 REST API Endpoint**: Send prompts to `POST /api/ask` and get text responses back.
- **🌐 Public Access**: Automatically creates a secure `localtunnel` URL, so you can call your local Gemini instance from anywhere (e.g., n8n, Zapier, mobile apps).
- **⚡ Real-time Communication**: Uses Socket.io for instant, low-latency communication between the server and the browser.
- **🔌 Native Launcher**: Includes a Chrome Native Messaging host to automatically spawn the server when you open Chrome (Windows).

---

## 🛠 Architecture

1. **The Server (`/server`)**: A lightweight Node.js Express server. It holds the state and creates the tunnel.
2. **The Extension (`/extension`)**: Injects a script into `gemini.google.com` to act as a puppet, executing your prompts and scraping the responses.
3. **The Launcher (`/launcher`)**: (Optional) A native bridge that lets the extension manage the server process directly.

---

## 📦 Installation

### 1. Prerequisites
- **Node.js** (v16 or higher) installed.
- **Google Chrome** browser.

### 2. Setup Server
Navigate to the server directory and install dependencies:
```bash
cd server
npm install
```

### 3. Load Extension
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer Mode** (top right toggle).
3. Click **Load unpacked**.
4. Select the `extension` folder from this manufacturer.
5. **Copy the Extension ID** (e.g., `abcdef...`) - you'll need it for the launcher!

### 4. Setup Launcher (Windows Only)
This step allows the extension to automatically start the server.
1. Open `launcher/install.bat`.
2. Paste the **Extension ID** when prompted.
3. The script will register the Native Messaging Host in your registry.

---

## 🔥 Usage

### Manual Start (If skipping Launcher)
If you didn't set up the launcher, just run the server manually:
```bash
cd server
npm start
```

### Making a Request
Once the server is running (you'll see a green `PUBLIC TUNNEL URL` in the console), you can send requests.

**Example using cURL:**
```bash
curl -X POST https://your-tunnel-url.loca.lt/api/ask \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Explain Quantum Physics in 5 words"}'
```

**JSON Response:**
```json
{
  "response": "Energy is quantized in discrete packets."
}
```

---

## ⚠️ Disclaimer
This project is for educational purposes only. It is not affiliated with, endorsed by, or connected to Google. Automated interaction with web services may violate their Terms of Service. Use responsibly.

---

Made with ❤️ by Giorgia Lari
