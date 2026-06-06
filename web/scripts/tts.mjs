/* Pre-render per-node narration with Gemini TTS → web/public/narration/<id>.wav
   Run: node --env-file=.env.local scripts/tts.mjs
   Reads the precached graph; falls back gracefully per node. */
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: KEY });

// candidate TTS models, first that works wins
const MODELS = [
  process.env.CODEMAP_TTS_MODEL,
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
  "gemini-3.1-flash-tts",
  "gemini-3.1-flash-tts-preview",
  "gemini-3.5-flash-tts",
].filter(Boolean);
const VOICE = process.env.CODEMAP_TTS_VOICE || "Charon"; // calm narrator

function wavFromPcm(pcm, sampleRate = 24000, channels = 1, bits = 16) {
  const blockAlign = (channels * bits) / 8;
  const byteRate = sampleRate * blockAlign;
  const buf = Buffer.alloc(44 + pcm.length);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + pcm.length, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(pcm.length, 40);
  pcm.copy(buf, 44);
  return buf;
}

function readGraph() {
  const p = path.resolve("src/lib/precached.ts");
  const src = fs.readFileSync(p, "utf8");
  const eq = src.indexOf("export const PRECACHED");
  const start = src.indexOf("{", eq);
  const end = src.lastIndexOf("}");
  return JSON.parse(src.slice(start, end + 1));
}

async function tts(model, text) {
  const resp = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
    },
  });
  const part = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error("no audio in response");
  const mime = part.inlineData.mimeType || "";
  const rateMatch = /rate=(\d+)/.exec(mime);
  const rate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
  const pcm = Buffer.from(part.inlineData.data, "base64");
  return wavFromPcm(pcm, rate);
}

async function pickModel(sample) {
  for (const m of MODELS) {
    try {
      const wav = await tts(m, sample);
      console.log(`  TTS model OK: ${m} (voice ${VOICE})`);
      return { model: m, firstWav: wav };
    } catch (e) {
      console.log(`  ${m} → ${String(e.message || e).slice(0, 80)}`);
    }
  }
  throw new Error("No working TTS model");
}

(async () => {
  const graph = readGraph();
  const outDir = path.resolve("public/narration");
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Pre-rendering narration for ${graph.nodes.length} nodes…`);

  // determine working model using the first node, reuse its audio
  const first = graph.nodes[0];
  const { model, firstWav } = await pickModel(first.narration || first.label);
  fs.writeFileSync(path.join(outDir, `${first.id}.wav`), firstWav);
  console.log(`  ✓ ${first.id}.wav`);

  for (const node of graph.nodes.slice(1)) {
    const text = node.narration || node.summary || node.label;
    try {
      const wav = await tts(model, text);
      fs.writeFileSync(path.join(outDir, `${node.id}.wav`), wav);
      console.log(`  ✓ ${node.id}.wav`);
    } catch (e) {
      console.log(`  ✗ ${node.id} → ${String(e.message || e).slice(0, 80)}`);
    }
  }
  console.log(`Done → web/public/narration/`);
})();
