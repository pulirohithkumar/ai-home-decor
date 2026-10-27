
exports.handler = async (event) => {
  const reply = (statusCode, body) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  });

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Use POST for image generation." });
  }

  if (!process.env.HF_TOKEN) {
    return reply(503, { error: "HF_TOKEN is missing in Netlify." });
  }

  try {
    const { image, room, style, extra = "" } =
      JSON.parse(event.body || "{}");

    const match = typeof image === "string"
      ? image.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/)
      : null;

    if (!match) {
      return reply(400, { error: "Upload a PNG, JPG, or WebP room photo." });
    }

    const rooms = [
      "living room", "bedroom", "kitchen",
      "dining room", "home office", "bathroom"
    ];

    const styles = [
      "modern minimalist", "warm bohemian", "Scandinavian",
      "luxury contemporary", "industrial modern", "traditional Indian"
    ];

    if (!rooms.includes(room) || !styles.includes(style)) {
      return reply(400, { error: "Choose a valid room and style." });
    }

    if (match[2].length > 10_000_000) {
      return reply(413, { error: "Image is too large. Try a smaller photo." });
    }

    const prompt =
      `Redesign this ${room} in ${style} style. Preserve the original ` +
      `room layout, doors, windows, walls and camera angle. Create a ` +
      `photorealistic, tasteful interior design. ${String(extra).slice(0, 300)}`;

    const upstream = await fetch(
      "https://router.huggingface.co/fal-ai/models/black-forest-labs/FLUX.2-klein-9B",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: match[2],
          parameters: {
            prompt
          },
          model: "black-forest-labs/FLUX.2-klein-9B"
        })
      }
    );

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 400);
      return reply(502, {
        error: `Hugging Face error ${upstream.status}: ${detail}`
      });
    }

    const contentType = upstream.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      const detail = (await upstream.text()).slice(0, 300);
      return reply(502, { error: `Unexpected provider response: ${detail}` });
    }

    const result = Buffer.from(await upstream.arrayBuffer());

    return reply(200, {
      image: `data:${contentType.split(";")[0]};base64,${result.toString("base64")}`
    });
  } catch (err) {
    return reply(502, {
      error: String(err.message || err).slice(0, 400)
    });
  }
};
