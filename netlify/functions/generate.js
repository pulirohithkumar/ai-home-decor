
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return reply(405, {
      error: "Use POST for image generation."
    });
  }

  if (!process.env.HF_TOKEN) {
    return reply(503, {
      error: "AI is not configured yet. Add HF_TOKEN in Netlify."
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "Invalid request body." });
  }

  const { image, room, style, extra = "" } = body;

  if (typeof image !== "string" ||
      !image.startsWith("data:image/")) {
    return reply(400, { error: "Please upload a valid room image." });
  }

  const allowedRooms = [
    "living room", "bedroom", "kitchen",
    "dining room", "home office", "bathroom"
  ];

  const allowedStyles = [
    "modern minimalist", "warm bohemian",
    "Scandinavian", "luxury contemporary",
    "industrial modern", "traditional Indian"
  ];

  if (!allowedRooms.includes(room) ||
      !allowedStyles.includes(style)) {
    return reply(400, {
      error: "Choose a valid room type and decor style."
    });
  }

  try {
    const match = image.match(
      /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/
    );

    if (!match) {
      return reply(400, {
        error: "Use a PNG, JPG, or WebP image."
      });
    }

    const prompt =
      `Redesign this existing ${room} in ${style} interior design style. ` +
      `Preserve the room layout, walls, doors, windows, and camera angle. ` +
      `Make the result photorealistic and achievable. ` +
      String(extra).slice(0, 300);

    const model = process.env.HF_MODEL ||
      "black-forest-labs/FLUX.2-klein-9B";

    const upstream = await fetch(
      `https://router.huggingface.co/fal-ai/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: match[2],
          parameters: { prompt }
        })
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text();
      return reply(502, {
        error: `AI provider error (${upstream.status}). ${detail.slice(0, 300)}`
      });
    }

    const contentType =
      upstream.headers.get("content-type") || "";

    if (!contentType.includes("image/")) {
      const detail = await upstream.text();
      return reply(502, {
        error: `Provider did not return an image. ${detail.slice(0, 250)}`
      });
    }

    const result = Buffer.from(await upstream.arrayBuffer());

    return reply(200, {
      image: `data:${contentType.split(";")[0]};base64,${result.toString("base64")}`
    });
  } catch (err) {
    return reply(502, {
      error: `Could not contact AI provider: ${String(err.message || err).slice(0, 200)}`
    });
  }
};

function reply(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
