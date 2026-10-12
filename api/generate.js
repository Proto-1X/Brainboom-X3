
 // BrainBoom X³ — Vercel Serverless Function
// Primary image provider: Cloudflare Workers AI (FLUX.1 Schnell)

const CLOUDFLARE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const prompt =
    typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  if (prompt.length > 8000) {
    return res.status(413).json({
      error: "Prompt is too long. Please shorten your creature description."
    });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return res.status(500).json({
      error: "Cloudflare credentials are missing. Check CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Vercel."
    });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLOUDFLARE_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Cloudflare image generation failed:",
        response.status,
        errorText.slice(0, 1500)
      );

      return res.status(response.status === 429 ? 429 : 502).json({
        error: "Cloudflare image generation failed.",
        details: errorText.slice(0, 1000)
      });
    }

    const contentType =
      response.headers.get("content-type") || "image/jpeg";

    // Cloudflare normally returns the generated image as binary data.
    // Handle a JSON-wrapped response too, if the API returns one.
    let imageBase64;
    let mimeType = contentType.split(";")[0].trim();

    if (mimeType.includes("application/json")) {
      const data = await response.json();
      const imageData = data?.result?.image || data?.result?.data;

      if (typeof imageData === "string") {
        imageBase64 = imageData;
      } else if (imageData instanceof ArrayBuffer) {
        imageBase64 = Buffer.from(imageData).toString("base64");
      }

      mimeType = data?.result?.mimeType || "image/jpeg";
    } else {
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      imageBase64 = imageBuffer.toString("base64");
    }

    if (!imageBase64) {
      console.error("Cloudflare returned no image data.");
      return res.status(502).json({
        error: "Cloudflare responded, but no image data was found."
      });
    }

    return res.status(200).json({
      imageBase64,
      mimeType,
      provider: "cloudflare-flux-schnell"
    });
  } catch (error) {
    console.error("Cloudflare image generation error:", error);
    return res.status(500).json({
      error: "The image-generation server encountered an unexpected error."
    });
  }
}
