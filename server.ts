import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

  // Configure OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

  // Configure multer for video uploads
  const upload = multer({ 
    dest: "uploads/",
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit
  });

  app.use(express.json({ limit: '200mb' }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      geminiConfigured: !!ai,
      openaiConfigured: !!openai
    });
  });

  // AI Processing Endpoint
  app.post("/api/process-video", async (req, res) => {
    if (!ai && !openai) {
      return res.status(500).json({ error: "No AI API keys configured on server" });
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

    // Try Gemini first
    if (ai) {
      try {
        console.log("[Server] Using Gemini for video processing...");
        const model = "gemini-3-flash-preview";
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

        if (result.text) {
          return res.json(JSON.parse(result.text));
        }
      } catch (error: any) {
        console.error("Gemini Server Error, falling back to OpenAI if available:", error);
        if (!openai) throw error;
      }
    }

    // Fallback to OpenAI
    if (openai) {
      try {
        console.log("[Server] Using OpenAI for video processing...");
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
                    format: mimeType.includes("mp4") ? "mp4" : "wav"
                  }
                }
              ]
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (content) {
          return res.json(JSON.parse(content));
        }
      } catch (error: any) {
        console.error("OpenAI Server Error:", error);
        res.status(500).json({ error: error.message || "Failed to process video with OpenAI" });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
