
const { Client, handle_file } = require("@gradio/client");

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

  try {
    const { image, room, style, extra = "" } =
      JSON.parse(event.body || "{}");

    const match = typeof image === "string"
      ? image.match(/^data:image\/(png|jpeg|webp);base64,([\s\S]+)$/)
      : null;

    if (!match) {
      return reply(400, {
        error: "Upload a PNG, JPG, or WebP room photo."
      });
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
      return reply(400, {
        error: "Choose a valid room and style."
      });
    }

    const prompt =
      `Redesign this ${room} in ${style} style. ` +
      "Preserve the existing layout, walls, doors, windows, " +
      "and camera angle. Photorealistic interior design. " +
      String(extra).slice(0, 300);

    const imageBuffer = Buffer.from(match[2], "base64");
    const imageBlob = new Blob([imageBuffer], {
      type: `image/${match[1]}`
    });

    const client = await Client.connect(
      "yashAI007/Image_to_Image_Generation"
    );

    const result = await client.predict("/img_args", [
      prompt,
      "blurry, low quality, distorted walls, distorted furniture",
      handle_file(imageBlob),
      "Realistic_Vision_V5_1_noVAE",
      "Euler a",
      896,
      896,
      30,
      7.5,
      1,
      0,
      0.8
    ]);

    const output = result.data?.[0]?.[0]?.image;

    if (!output) {
      console.error("Unexpected Space response:", result.data);
      return reply(502, {
        error: "The image service returned no generated image."
      });
    }

    const outputResponse = await fetch(output.url);

    if (!outputResponse.ok) {
      throw new Error("Could not retrieve the generated image.");
    }

    const outputBuffer = Buffer.from(
      await outputResponse.arrayBuffer()
    );

    return reply(200, {
      image: `data:image/png;base64,${outputBuffer.toString("base64")}`
    });
  } catch (err) {
    console.error("Image generation failed:", err);
    return reply(502, {
      error: `Image generation failed: ${String(
        err.message || err
      ).slice(0, 250)}`
    });
  }
};
