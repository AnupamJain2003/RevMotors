    const ws = new WebSocket(`ws://${location.hostname}:8787/client`);
const logEl = document.getElementById('log');
const micBtn = document.getElementById('mic');
const sendBtn = document.getElementById('send');
const textIn = document.getElementById('text');
const langSel = document.getElementById('lang');

let audioCtx, micStream, captureNode, playbackNode;

function log(line) {
  logEl.innerHTML = `${new Date().toLocaleTimeString()} • ${line}<br>` + logEl.innerHTML;
}

async function setupAudio() {
  if (audioCtx) return audioCtx;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  await audioCtx.audioWorklet.addModule('./audio-capture.worklet.js');
  await audioCtx.audioWorklet.addModule('./audio-playback.worklet.js');
  playbackNode = new AudioWorkletNode(audioCtx, 'pcm24k-playback');
  playbackNode.connect(audioCtx.destination);
  return audioCtx;
}

ws.binaryType = 'arraybuffer';

ws.onmessage = (ev) => {
  if (ev.data instanceof ArrayBuffer) {
    playbackNode?.port.postMessage({ type: 'append', buffer: ev.data });
  } else {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'ready') log('Gemini session ready');
    if (msg.type === 'status') log(`${msg.value}`);
    if (msg.type === 'error') log(`Error: ${msg.value}`);
    if (msg.type === 'turnComplete') log('Turn complete');
    if (msg.type === 'interrupted') log('Response interrupted');
  }
};

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'start', config: { systemInstruction: 'You are Rev, the Revolt Motors voice assistant. Talk only about Revolt Motors.' } }));
  log('WebSocket connected');
};

async function startMic() {
  await setupAudio();
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const src = audioCtx.createMediaStreamSource(micStream);
  captureNode = new AudioWorkletNode(audioCtx, 'pcm16k-capture');
  captureNode.port.onmessage = (e) => {
    if (e.data?.type === 'chunk') {
      ws.send(e.data.buffer);
    }
  };
  src.connect(captureNode);
  captureNode.connect(audioCtx.destination);
  micBtn.classList.add('rec');
  log('Recording… hold to talk');
}

function stopMic() {
  captureNode?.disconnect(); captureNode = null;
  micStream?.getTracks().forEach(t => t.stop());
  micStream = null;
  micBtn.classList.remove('rec');
  ws.send(JSON.stringify({ type: 'interrupt' }));
  log('Interrupted');
}

micBtn.onmousedown = () => startMic();
micBtn.onmouseup = () => stopMic();
micBtn.onmouseleave = () => { if (micStream) stopMic(); };

sendBtn.onclick = () => {
  const t = textIn.value.trim();
  if (!t) return;
  const lang = langSel.value;
  const primer = lang !== 'auto' ? `Respond in ${lang}. ` : '';
  ws.send(JSON.stringify({ type: 'text', value: primer + t }));
  textIn.value = '';
};
