// Netlify serverless function. Set HF_TOKEN in Netlify Site configuration.
// The provider/model may require an account with enabled Inference Providers access.
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Use POST for image generation." });
  }
  if (!process.env.HF_TOKEN) {
    return reply(503, { error: "AI is not configured yet. Add HF_TOKEN under Netlify environment variables, then redeploy." });
  }
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return reply(400, { error: "Invalid request body." }); }

  const { image, room, style, extra = "" } = body;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return reply(400, { error: "Please upload a valid room image." });
  }
  if (image.length > 12_000_000) {
    return reply(413, { error: "Image is too large. Please upload an image under 8 MB." });
  }
  const allowedRooms = ["living room", "bedroom", "kitchen", "dining room", "home office", "bathroom"];
  const allowedStyles = ["modern minimalist", "warm bohemian", "Scandinavian", "luxury contemporary", "industrial modern", "traditional Indian"];
  if (!allowedRooms.includes(room) || !allowedStyles.includes(style)) {
    return reply(400, { error: "Choose a valid room type and decor style." });
  }

  try {
    const match = image.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/);
    if (!match) return reply(400, { error: "Use a PNG, JPG, or WebP image." });
    const mime = match[1];
    const bytes = Buffer.from(match[2], "base64");
    const prompt = `Redesign this existing ${room} in ${style} interior design style. Preserve the room's basic layout, walls, doors, windows, and camera angle. Make the result photorealistic, tasteful, coherent, and achievable. ${String(extra).slice(0, 300)}`;

    // Hugging Face's Inference API uses a multipart image input for image-to-image models.
    const form = new FormData();
    form.append("inputs", new Blob([bytes], { type: mime }), `room.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`);
    form.append("parameters", JSON.stringify({ prompt }));

    const model = process.env.HF_MODEL || "black-forest-labs/FLUX.2-klein-9B";
    const upstream = await fetch(`https://router.huggingface.co/fal-ai/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
      body: form
    });
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok) {
      const detail = await upstream.text();
      return reply(upstream.status === 401 || upstream.status === 403 ? 502 : 502, {
        error: `AI provider error (${upstream.status}). ${shortError(detail)}`
      });
    }
    if (!contentType.includes("image/")) {
      const detail = await upstream.text();
      return reply(502, { error: `The AI provider did not return an image. ${shortError(detail)}` });
    }
    const result = Buffer.from(await upstream.arrayBuffer());
    return reply(200, { image: `data:${contentType.split(";")[0]};base64,${result.toString("base64")}` });
  } catch (err) {
    return reply(502, { error: `Could not contact the AI provider: ${String(err.message || err).slice(0, 180)}` });
  }
};

function shortError(text) {
  try {
    const parsed = JSON.parse(text);
    return String(parsed.error || parsed.message || text).slice(0, 260);
  } catch { return String(text).slice(0, 260); }
}
function reply(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
