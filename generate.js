// api/generate.js
// Vercel Serverless function (Node/Edge compatible). Uses Stability AI text->image endpoint.
// Set STABILITY_API_KEY in Vercel Environment Variables.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server not configured: STABILITY_API_KEY' });

    // Choose a model available to your account. Example: stable-diffusion-xl-1024-v1-0
    const model = 'stable-diffusion-xl-1024-v1-0';

    // Build request to Stability API (text-to-image)
    const stabilityUrl = `https://api.stability.ai/v1/generation/${model}/text-to-image`;

    const body = {
      text_prompts: [
        {
          text: prompt
        }
      ],
      // cfg_scale, steps, samples etc — tune as needed
      cfg_scale: 7,
      clip_guidance_preset: 'NONE',
      height: 1024,
      width: 1024,
      samples: 1
    };

    const response = await fetch(stabilityUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('Stability API error:', details);
      return res.status(response.status).json({ error: 'Stability API error', details });
    }

    // Many Stability endpoints return JSON with base64 in `artifacts` or `images`.
    const data = await response.json();

    // Try several common paths to get base64
    let base64 = null;
    if (data?.images && Array.isArray(data.images) && data.images[0]?.b64_json) {
      base64 = data.images[0].b64_json;
    } else if (data?.artifacts && data.artifacts[0]?.base64) {
      base64 = data.artifacts[0].base64;
    } else if (data?.artifacts && data.artifacts[0]?.b64_json) {
      base64 = data.artifacts[0].b64_json;
    }

    if (!base64) {
      // If Stability returns a different shape, return the whole object for debugging (will show in console)
      return res.status(200).json({ error: 'no_base64', raw: data });
    }

    // Return normalized object to the frontend
    return res.status(200).json({ imageBase64: base64 });
  } catch (err) {
    console.error('Server error', err);
    return res.status(500).json({ error: 'server_error', details: String(err) });
  }
}
