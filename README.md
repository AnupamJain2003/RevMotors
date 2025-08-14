1. Project Structure
text
gemini-live-revolt/
├── server.js                # Node.js Express + WebSocket server
├── package.json             # npm config and dependencies
├── public/
│   ├── index.html           # Simple frontend UI
│   ├── client.js            # Frontend WebSocket & Audio client
│   ├── audio-capture.worklet.js  # AudioWorklet for mic capture
│   ├── audio-playback.worklet.js # AudioWorklet for playback
├── .env                    # Environment variables (API key, port)
├── README.md               # Setup instructions

Setup Instructions (in README.md)
Install dependencies:


npm install

Create and fill .env file with your API key and config.

Run the server:

npm start

Serve the frontend files (already served as static by Express /public).

Open browser at http://localhost:8787.

Test voice chat by clicking and holding "Hold to Talk" button or typing and sending messages.

Interrupt speech by clicking again or starting new talk.

This project setup creates a server-to-server architecture with Node.js backend handling Gemini Live API sessions and WebSocket communication, and a simple frontend for microphone capture, audio playback, and text interaction.

It fulfills the functional requirements:

Real-time conversational flow with voice and text.

Interruptions supported via explicit “interrupt” messages and Gemini’s native handling.

Low latency by streaming audio chunks immediately.

System instructions restricting assistant to Revolt Motors context.
