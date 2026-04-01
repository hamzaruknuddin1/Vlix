import { GoogleGenAI, Type } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API key not configured on server" });
  }

  const ai = new GoogleGenAI({ apiKey });
  const { videoBase64, mimeType } = req.body;

  if (!videoBase64 || !mimeType) {
    return res.status(400).json({ error: "Missing video data or mimeType" });
  }

  try {
    const model = "gemini-3-flash-preview";
    const systemInstruction = `
      You are a video analysis expert. Your task is to:
      1. Generate a detailed transcript of SPOKEN words with precise timestamps.
      2. Identify VISUAL TEXT (words written on screen, signs, overlays) with timestamps.
      3. Identify VISUAL OBJECTS, ENTITIES, and ACTIONS (things that appear but aren't spoken or written) with timestamps.
      
      Output MUST be in JSON format matching the requested schema.
      Be as concise as possible in descriptions to reduce latency.
    `;

    const prompt = "Analyze this video for spoken transcript, visual text, and visual objects/actions.";
    const videoPart = {
      inlineData: {
        data: videoBase64,
        mimeType: mimeType,
      },
    };

    const result = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }, videoPart] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.NUMBER },
                  text: { type: Type.STRING }
                },
                required: ["timestamp", "text"]
              }
            },
            visualText: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.NUMBER },
                  text: { type: Type.STRING }
                },
                required: ["timestamp", "text"]
              }
            },
            visualObjects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.NUMBER },
                  name: { type: Type.STRING }
                },
                required: ["timestamp", "name"]
              }
            }
          },
          required: ["transcript", "visualText", "visualObjects"]
        }
      }
    });

    if (!result.text) {
      throw new Error("Empty response from AI model");
    }

    res.status(200).json(JSON.parse(result.text));
  } catch (error: any) {
    console.error("Gemini Vercel Error:", error);
    res.status(500).json({ error: error.message || "Failed to process video" });
  }
}
