import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'path';

const PORT = process.env.PORT || 8787;
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000'; // your frontend origin

const app = express();
app.use(cors({ origin: ORIGIN }));
app.use(express.static('public'));

app.get('/health', (_req, res) => res.json({ ok: true }));

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const wss = new WebSocketServer({ server, path: '/client' });

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

let SYSTEM_PROMPT = 'You are Rev, Revolt Motors voice assistant.';
try {
  SYSTEM_PROMPT = await fs.readFile(new URL('./system-prompt.txt', import.meta.url), 'utf8');
} catch {
  // fallback
}

wss.on('connection', async (ws) => {
  console.log('Client connected');
  let session;
  let closing = false;

  function sendClient(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(obj instanceof Buffer ? obj : JSON.stringify(obj));
    }
  }

  async function openSession(config = {}) {
    if (session) return session;
    session = await ai.live.connect({
      model: 'models/gemini-2.0-flash-live-001',
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: SYSTEM_PROMPT,
        ...config,
      },
      callbacks: {
        onopen: () => sendClient({ type: 'status', value: 'gemini_open' }),
        onmessage: (msg) => {
          if (msg.data) {
            const buf = Buffer.from(msg.data, 'base64');
            ws.send(buf);
          }
          if (msg.serverContent?.modelTurn?.parts?.length) {
            sendClient({ type: 'partial', value: 'audio' });
          }
          if (msg.serverContent?.turnComplete) {
            sendClient({ type: 'turnComplete' });
          }
          if (msg.serverContent?.interrupted) {
            sendClient({ type: 'interrupted' });
          }
        },
        onerror: (e) => sendClient({ type: 'error', value: e.message }),
        onclose: () => sendClient({ type: 'status', value: 'gemini_closed' }),
      },
    });
    return session;
  }

  ws.on('message', async (data, isBinary) => {
    try {
      if (isBinary) {
        const s = await openSession();
        s.sendRealtimeInput({
          audio: { data: data.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
        });
        return;
      }
      const msg = JSON.parse(data.toString());

      if (msg.type === 'start') {
        await openSession(msg.config || {});
        sendClient({ type: 'ready' });
      }
      if (msg.type === 'text') {
        const s = await openSession();
        s.send({ clientContent: { turns: [{ role: 'user', parts: [{ text: msg.value }] }] } });
      }
      if (msg.type === 'interrupt') {
        const s = await openSession();
        s.send({ clientContent: { turns: [] } });
        sendClient({ type: 'interrupted' });
      }
      if (msg.type === 'close') {
        closing = true;
        if (session) session.close();
        ws.close();
      }
    } catch (e) {
      sendClient({ type: 'error', value: e.message });
    }
  });

  ws.on('close', () => {
    if (!closing && session) try { session.close(); } catch {}
    session = undefined;
  });
});
