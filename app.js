const form = document.querySelector("#decor-form");
const fileInput = document.querySelector("#room-image");
const preview = document.querySelector("#preview");
const uploadTitle = document.querySelector("#upload-title");
const uploadSubtitle = document.querySelector("#upload-subtitle");
const statusBox = document.querySelector("#status");
const generateBtn = document.querySelector("#generate-btn");
const resultArea = document.querySelector("#result-area");
const resultActions = document.querySelector("#result-actions");
let generatedUrl = "";

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    fileInput.value = "";
    statusBox.textContent = "Please choose an image smaller than 8 MB.";
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  uploadTitle.textContent = file.name;
  uploadSubtitle.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB selected`;
  statusBox.textContent = "";
});

const dropZone = document.querySelector("#drop-zone");
["dragenter", "dragover"].forEach(eventName => dropZone.addEventListener(eventName, e => {
  e.preventDefault(); dropZone.style.background = "#f5e9df";
}));
["dragleave", "drop"].forEach(eventName => dropZone.addEventListener(eventName, e => {
  e.preventDefault(); dropZone.style.background = "";
}));
dropZone.addEventListener("drop", e => {
  const file = e.dataTransfer.files?.[0];
  if (!file) return;
  const transfer = new DataTransfer(); transfer.items.add(file); fileInput.files = transfer.files;
  fileInput.dispatchEvent(new Event("change"));
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  const file = fileInput.files?.[0];
  if (!file) { statusBox.textContent = "Please upload a room photo first."; return; }
  if (file.size > 8 * 1024 * 1024) { statusBox.textContent = "Please choose an image smaller than 8 MB."; return; }
  const style = form.querySelector('input[name="style"]:checked').value;
  const room = document.querySelector("#room-type").value;
  const extra = document.querySelector("#extra").value.trim();
  generateBtn.disabled = true;
  generateBtn.textContent = "Creating your design…";
  statusBox.textContent = "Sending your photo to the AI service. This may take a minute.";
  try {
    const imageData = await readAsDataURL(file);
   const response = await fetch("/api/generate", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({image: imageData, room, style, extra})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    if (!data.image) throw new Error("The AI service did not return an image.");
    generatedUrl = data.image;
    resultArea.innerHTML = "";
    const image = document.createElement("img");
    image.alt = `AI-generated ${style} ${room} design`;
    image.src = data.image;
    resultArea.appendChild(image);
    resultActions.hidden = false;
    statusBox.textContent = "Your new room concept is ready!";
  } catch (err) {
    statusBox.textContent = `${err.message} Check the deployment README and Netlify function logs.`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = "<span>✦</span> Generate my room design";
  }
});

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

document.querySelector("#download-btn").addEventListener("click", async () => {
  if (!generatedUrl) return;
  try {
    const res = await fetch(generatedUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "roombloom-ai-design.png"; a.click();
    URL.revokeObjectURL(url);
  } catch { window.open(generatedUrl, "_blank", "noopener"); }
});
document.querySelector("#reset-btn").addEventListener("click", () => {
  form.reset(); fileInput.value = ""; preview.hidden = true; preview.removeAttribute("src");
  uploadTitle.textContent = "Choose an image or drop it here";
  uploadSubtitle.textContent = "PNG, JPG or WebP · Max 8 MB";
  resultArea.innerHTML = '<div class="empty-art"><div class="sun"></div><div class="art-window"><span></span></div><div class="art-frame"></div><div class="plant"><i></i><i></i><i></i><i></i><b></b></div><div class="sofa"><div></div><div></div><div></div></div><div class="table"></div><div class="rug"></div></div><h3>Your next favourite room starts here.</h3><p>Upload a photo and generate a fresh decor concept.</p>';
  resultActions.hidden = true; statusBox.textContent = ""; generatedUrl = "";
});
