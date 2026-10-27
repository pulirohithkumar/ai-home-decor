
const { InferenceClient } = require("@huggingface/inference");

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

    const prompt =
      `Redesign this ${room} in ${style} style. Preserve the room's ` +
      `layout, walls, doors, windows, and camera angle. Make it photorealistic. ` +
      String(extra).slice(0, 300);

    const client = new InferenceClient(process.env.HF_TOKEN);

    const inputImage = Buffer.from(match[2], "base64");

    const result = await client.imageToImage({
      inputs: new Blob([inputImage], { type: match[1] }),
      model: "black-forest-labs/FLUX.2-klein-9B",
      parameters: { prompt }
    });

    const output = Buffer.from(await result.arrayBuffer());

    return reply(200, {
      image: `data:image/png;base64,${output.toString("base64")}`
    });
  } catch (err) {
    console.error("Image generation failed:", err);
    return reply(502, {
      error: `Image generation failed: ${String(err.message || err).slice(0, 350)}`
    });
  }
};
