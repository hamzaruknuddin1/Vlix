import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    return res.status(500).json({ error: "Neither Gemini nor OpenAI API keys are configured" });
  }

  const { videoBase64, mimeType } = req.body;
  if (!videoBase64 || !mimeType) {
    return res.status(400).json({ error: "Missing video data or mimeType" });
  }

  const systemInstruction = `
    You are a video analysis expert. Your task is to:
    1. Generate a detailed transcript of SPOKEN words with precise timestamps.
    2. Identify VISUAL TEXT (words written on screen, signs, overlays) with timestamps.
    3. Identify VISUAL OBJECTS, ENTITIES, and ACTIONS (things that appear but aren't spoken or written) with timestamps.
    
    Output MUST be in JSON format matching the requested schema.
    Be as concise as possible in descriptions to reduce latency.
  `;

  const responseSchema = {
    type: "object",
    properties: {
      transcript: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "number" },
            text: { type: "string" }
          },
          required: ["timestamp", "text"]
        }
      },
      visualText: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "number" },
            text: { type: "string" }
          },
          required: ["timestamp", "text"]
        }
      },
      visualObjects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "number" },
            name: { type: "string" }
          },
          required: ["timestamp", "name"]
        }
      }
    },
    required: ["transcript", "visualText", "visualObjects"]
  };

  // Try Gemini first
  if (geminiKey) {
    try {
      console.log("[API] Using Gemini for video processing...");
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const model = "gemini-3-flash-preview";
      
      const result = await ai.models.generateContent({
        model: model,
        contents: { 
          parts: [
            { text: "Analyze this video for spoken transcript, visual text, and visual objects/actions." }, 
            { inlineData: { data: videoBase64, mimeType: mimeType } }
          ] 
        },
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

      if (result.text) {
        return res.status(200).json(JSON.parse(result.text));
      }
    } catch (error: any) {
      console.error("Gemini Error, falling back to OpenAI if available:", error);
      if (!openaiKey) throw error;
    }
  }

  // Fallback to OpenAI
  if (openaiKey) {
    try {
      console.log("[API] Using OpenAI for video processing...");
      const openai = new OpenAI({ apiKey: openaiKey });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this video for spoken transcript, visual text, and visual objects/actions." },
              {
                type: "input_audio",
                input_audio: {
                  data: videoBase64,
                  format: mimeType.includes("mp4") ? "mp4" : "wav" // Basic mapping
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (content) {
        return res.status(200).json(JSON.parse(content));
      }
    } catch (error: any) {
      console.error("OpenAI Error:", error);
      return res.status(500).json({ error: error.message || "Failed to process video with OpenAI" });
    }
  }

  return res.status(500).json({ error: "Processing failed on all available AI models" });
}
