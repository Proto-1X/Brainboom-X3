
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const message =
    typeof body?.message === "string"
      ? body.message.trim()
      : "";

  const creatureName =
    typeof body?.creature?.name === "string"
      ? body.creature.name.trim().slice(0, 40)
      : "Buddy";

  const animal =
    typeof body?.creature?.animal === "string"
      ? body.creature.animal.trim().slice(0, 100)
      : "a friendly fantasy creature";

  const personality =
    typeof body?.creature?.personality === "string"
      ? body.creature.personality.trim().slice(0, 100)
      : "friendly and curious";

  if (!message) {
    return res.status(400).json({
      error: "Please enter a message."
    });
  }

  if (message.length > 500) {
    return res.status(400).json({
      error: "Please keep your message under 500 characters."
    });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return res.status(500).json({
      error: "Cloudflare credentials are missing."
    });
  }

  const systemPrompt = `
You are ${creatureName}, a fictional creature in BrainBoom X³,
an English-learning adventure for primary-school pupils.

Creature details:
- Creature type: ${animal}
- Personality: ${personality}

Your rules:
- Reply naturally to what the pupil actually says.
- Never rely on a fixed dialogue script.
- Use simple, age-appropriate English.
- Keep replies to 1–3 short sentences.
- Be warm, playful, patient, and encouraging.
- Ask a simple follow-up question when it fits naturally.
- Help pupils practise English without making them feel embarrassed.
- If the pupil makes an English mistake, model the correct form
  gently when useful. Do not correct every small mistake.
- Do not claim to be a real person or a real animal.
- Do not request personal information such as addresses,
  passwords, phone numbers, or school account details.
- If asked something unsafe or inappropriate, respond briefly
  and guide the pupil back to a safe topic.
- Return only the words your creature should say.
`;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: message
            }
          ],
          max_tokens: 120
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(
        "Creature AI request failed:",
        response.status,
        JSON.stringify(data).slice(0, 1000)
      );

      return res.status(502).json({
        error: "Your creature could not reply just now. Please try again."
      });
    }

    const reply = data.result?.response?.trim();

    if (!reply) {
      return res.status(502).json({
        error: "The creature returned an empty reply. Please try again."
      });
    }

    return res.status(200).json({
      reply,
      creature: creatureName
    });
  } catch (error) {
    console.error("Creature AI error:", error);

    return res.status(500).json({
      error: "The creature chat service encountered an error."
    });
  }
}

