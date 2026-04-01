export async function processVideo(frames: string[], mimeType: string) {
  try {
    console.log(`[Client] Sending ${frames.length} frames to server for processing...`);
    const startTime = Date.now();
    
    const response = await fetch("/api/process-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ frames, mimeType }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Client] AI response received from server in ${duration}s`);

    return await response.json();
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    throw new Error(error.message || "Failed to process video with AI");
  }
}
