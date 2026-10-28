
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { image, room, style, extra = "" } =
      await request.json();

    const match = typeof image === "string"
      ? image.match(/^data:image\/(png|jpeg|webp);base64,([\s\S]+)$/)
      : null;

    if (!match) {
      return jsonResponse({
        error: "Upload a PNG, JPG, or WebP room photo."
      }, 400);
    }

    const rooms = [
      "living room", "bedroom", "kitchen",
      "dining room", "home office", "bathroom",
      "Living room", "Bedroom", "Kitchen",
      "Dining room", "Home office", "Bathroom",
      "Other room"
    ];

    const styles = [
      "modern minimalist", "warm bohemian",
      "Scandinavian", "luxury contemporary",
      "industrial modern", "traditional Indian"
    ];

    if (!rooms.includes(room) || !styles.includes(style)) {
      return jsonResponse({
        error: "Choose a valid room and style."
      }, 400);
    }

    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const token = env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !token) {
      return jsonResponse({
        error: "Cloudflare credentials are missing. Check your Pages secrets."
      }, 500);
    }

    const prompt =
      `Redesign this ${room} in ${style} interior design style. ` +
      "Use the uploaded room photo as the reference image. " +
      "Preserve the room's walls, doors, windows, layout, " +
      "and camera angle. Produce a realistic interior design. " +
      String(extra).slice(0, 300);

    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const mime = match[1] === "jpeg"
      ? "image/jpeg"
      : `image/${match[1]}`;

    const form = new FormData();
    form.append("prompt", prompt);
    form.append(
      "input_image_0",
      new Blob([bytes], { type: mime }),
      `room.${match[1] === "jpeg" ? "jpg" : match[1]}`
    );
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
      console.error(
        "Cloudflare AI error:",
        apiResponse.status,
        await apiResponse.text()
      );

      return jsonResponse({
        error: `Cloudflare image generation failed (${apiResponse.status}). Check AI access, image dimensions, and usage limits.`
      }, 502);
    }

    const contentType =
      apiResponse.headers.get("content-type") || "";

    let outputBytes;

    if (contentType.includes("application/json")) {
      const result = await apiResponse.json();
      const encoded = result.result?.image;

      if (typeof encoded !== "string") {
        return jsonResponse({
          error: "Cloudflare returned an unexpected image response."
        }, 502);
      }

      const binaryOutput = atob(encoded);
      outputBytes = new Uint8Array(binaryOutput.length);

      for (let i = 0; i < binaryOutput.length; i++) {
        outputBytes[i] = binaryOutput.charCodeAt(i);
      }
    } else {
      outputBytes = new Uint8Array(
        await apiResponse.arrayBuffer()
      );
    }

    if (!outputBytes.length) {
      return jsonResponse({
        error: "Cloudflare returned an empty image."
      }, 502);
    }

    let outputBinary = "";
    for (let i = 0; i < outputBytes.length; i += 8192) {
      outputBinary += String.fromCharCode(
        ...outputBytes.subarray(i, i + 8192)
      );
    }

    return jsonResponse({
      image: `data:image/png;base64,${btoa(outputBinary)}`
    });
  } catch (error) {
    console.error("Image generation failed:", error);

    return jsonResponse({
      error: "Image generation failed. Please try again."
    }, 500);
  }
}
