import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      openaiConfigured: !!openai
    });
  });

  // AI Processing Endpoint
  app.post("/api/process-video", async (req, res) => {
    if (!openai) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured on server" });
    }

    const { frames, mimeType } = req.body;
    if (!frames || !Array.isArray(frames) || !mimeType) {
      return res.status(400).json({ error: "Missing frames data or mimeType" });
    }

    try {
      console.log(`[Vlix Server] Processing ${frames.length} frames with OpenAI GPT-4o...`);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `
              You are a video analysis expert. You are provided with a sequence of frames from a video.
              1. Generate a detailed transcript of SPOKEN words with precise timestamps (estimate based on frame sequence).
              2. Identify VISUAL TEXT (words written on screen, signs, overlays) with timestamps.
              3. Identify VISUAL OBJECTS, ENTITIES, and ACTIONS with timestamps.
              
              Output MUST be in JSON format with this structure:
              {
                "transcript": [{"timestamp": 0, "text": "..."}],
                "visualText": [{"timestamp": 0, "text": "..."}],
                "visualObjects": [{"timestamp": 0, "name": "..."}]
              }
            `
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze these video frames and provide the transcript, visual text, and objects." },
              ...frames.map((frame: string) => ({
                type: "image_url" as const,
                image_url: {
                  url: `data:${mimeType};base64,${frame}`
                }
              }))
            ]
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from OpenAI");

      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("OpenAI Server Error:", error);
      res.status(500).json({ error: error.message || "Failed to process video with OpenAI" });
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
