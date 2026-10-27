
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

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !token) {
      return reply(500, {
        error: "Cloudflare credentials are missing in Netlify."
      });
    }

    const prompt =
      `Redesign this ${room} in ${style} interior design style. ` +
      "Use the uploaded room photo as the reference image. " +
      "Preserve the room's walls, doors, windows, layout, " +
      "and camera angle. Produce a realistic interior design. " +
      String(extra).slice(0, 300);

    const imageBuffer = Buffer.from(match[2], "base64");

    // FLUX.2 Klein 4B accepts reference images smaller than 512x512.
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("input_image_0", new Blob([imageBuffer], {
      type: `image/${match[1]}`
    }), `room.${match[1] === "jpeg" ? "jpg" : match[1]}`);
    form.append("width", "512");
    form.append("height", "512");

    const apiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      }
    );

    if (!apiResponse.ok) {
      const details = await apiResponse.text();
      console.error("Cloudflare AI error:", apiResponse.status, details);

      return reply(502, {
        error: `Cloudflare image generation failed (${apiResponse.status}). Check your Cloudflare AI access and usage limits.`
      });
    }

    const contentType = apiResponse.headers.get("content-type") || "";
    let outputBuffer;

    if (contentType.includes("application/json")) {
      const result = await apiResponse.json();
      const encoded = result.result?.image;

      if (typeof encoded !== "string") {
        console.error("Unexpected Cloudflare response:", result);
        return reply(502, {
          error: "Cloudflare returned an unexpected image response."
        });
      }

      outputBuffer = Buffer.from(encoded, "base64");
    } else {
      outputBuffer = Buffer.from(await apiResponse.arrayBuffer());
    }

    if (!outputBuffer.length) {
      return reply(502, {
        error: "Cloudflare returned an empty image."
      });
    }

    return reply(200, {
      image: `data:image/png;base64,${outputBuffer.toString("base64")}`
    });
  } catch (err) {
    console.error("Image generation failed:", err);
    return reply(502, {
      error: "Image generation failed. Please try again."
    });
  }
};
