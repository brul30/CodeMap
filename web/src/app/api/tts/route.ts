/**
 * POST /api/tts  — Body: { text: string } → returns audio/wav (Gemini TTS).
 *
 * On-demand narration for LIVE-generated repos (whose nodes have no
 * pre-rendered file in public/narration). The precached demo repo still uses
 * its static WAVs for instant playback; this is the fallback before the
 * browser's Web Speech voice. GEMINI_API_KEY stays server-side.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({ text: z.string().min(1).max(2000) });

const VOICE = process.env.CODEMAP_TTS_VOICE || "Charon";
const MODELS = [
  process.env.CODEMAP_TTS_MODEL,
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
].filter(Boolean) as string[];

function wavFromPcm(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer {
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

type GenAudioResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { data: string; mimeType?: string } }> };
  }>;
};

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  for (const model of MODELS) {
    try {
      const resp = (await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: parsed.data.text }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      })) as GenAudioResponse;

      const part = resp.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part?.inlineData) continue;

      const mime = part.inlineData.mimeType || "";
      const rateMatch = /rate=(\d+)/.exec(mime);
      const rate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      const pcm = Buffer.from(part.inlineData.data, "base64");
      const wav = wavFromPcm(pcm, rate);

      return new NextResponse(new Uint8Array(wav), {
        status: 200,
        headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
      });
    } catch {
      // try the next model
    }
  }

  return NextResponse.json({ error: "TTS failed" }, { status: 502 });
}
