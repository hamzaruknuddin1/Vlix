export async function processVideo(videoBase64: string, mimeType: string) {
  try {
    console.log(`[Client] Sending video to server for processing (${(videoBase64.length / 1024 / 1024).toFixed(2)} MB)...`);
    const startTime = Date.now();
    
    const response = await fetch("/api/process-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ videoBase64, mimeType }),
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
