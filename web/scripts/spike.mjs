import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const models = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"];

for (const model of models) {
  try {
    const r = await ai.models.generateContent({
      model,
      contents: 'Reply with JSON only: {"greeting":"hi"}',
      config: { responseMimeType: "application/json" },
    });
    console.log(`OK  ${model} -> ${r.text}`);
    break;
  } catch (e) {
    console.log(`ERR ${model} -> ${String(e).slice(0, 200)}`);
  }
}
