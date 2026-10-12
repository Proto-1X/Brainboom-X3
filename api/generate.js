// Vercel Serverless Function: POST /api/generate
// Primary provider: Gemini image generation.
// Optional fallback: Stability AI, if STABILITY_API_KEY is also configured.

const GEMINI_MODEL = "gemini-2.5-flash-image";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });
  if (prompt.length > 8000) {
    return res.status(413).json({ error: "Prompt is too long. Please shorten your creature description." });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({
      error: "Server is missing GEMINI_API_KEY. Add it in Vercel Project Settings → Environment Variables, then redeploy."
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
        })
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMessage = data?.error?.message || `Gemini API returned HTTP ${response.status}`;
      console.error("Gemini image generation failed:", response.status, apiMessage);

      // Keep the previous provider as an optional fallback if its key is configured.
      if (process.env.STABILITY_API_KEY) {
        const fallback = await generateWithStability(prompt, process.env.STABILITY_API_KEY);
        if (fallback) return res.status(200).json({ imageBase64: fallback, provider: "stability-fallback" });
      }

      const status = response.status === 429 ? 429 : (response.status === 403 || response.status === 401 ? 502 : 502);
      return res.status(status).json({
        error: "Gemini image generation failed.",
        details: apiMessage
      });
    }

    const parts = data?.candidates?.flatMap(candidate => candidate?.content?.parts || []) || [];
    const imagePart = parts.find(part => part?.inlineData?.data || part?.inline_data?.data);
    const imageBase64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
    if (!imageBase64) {
      console.error("Gemini returned no image data.");
      return res.status(502).json({
        error: "Gemini responded, but no image was included. Check that the API key and model have image-generation access."
      });
    }

    return res.status(200).json({
      imageBase64,
      mimeType: imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || "image/png",
      provider: "gemini"
    });
  } catch (error) {
    console.error("Image generation server error:", error);
    return res.status(500).json({ error: "The image-generation server encountered an unexpected error." });
  }
}

async function generateWithStability(prompt, apiKey) {
  try {
    const response = await fetch(
      "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt }],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1
        })
      }
    );
    if (!response.ok) {
      console.error("Stability fallback failed with HTTP", response.status);
      return null;
    }
    const data = await response.json();
    return data?.artifacts?.[0]?.base64 || data?.artifacts?.[0]?.b64_json || data?.images?.[0]?.b64_json || null;
  } catch (error) {
    console.error("Stability fallback error:", error);
    return null;
  }
}
