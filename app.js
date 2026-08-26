const defaults = ["Choix 1", "Choix 2", "Choix 3", "Choix 4", "Choix 5", "Choix 6", "Choix 7"];
const colors = ["#f45b69", "#f8a75d", "#f6d365", "#86cfa5", "#6cbcc1", "#8d94cf", "#d18ab8"];
const canvas = document.querySelector("#wheel");
const context = canvas.getContext("2d");
const wheelButton = document.querySelector("#wheel-button");
const message = document.querySelector("#message");
const dialog = document.querySelector("#config-dialog");
const form = document.querySelector("#config-form");
const fields = document.querySelector("#choice-fields");
let choices = choicesFromUrl();
let rotation = 0;
let spinning = false;

function choicesFromUrl() {
  const packed = new URLSearchParams(location.search).get("c");
  if (!packed) return [...defaults];
  try {
    const values = JSON.parse(decodeURIComponent(escape(atob(packed))));
    return Array.isArray(values) && values.length === 7 && values.every((value) => typeof value === "string" && value.trim())
      ? values.map((value) => value.trim().slice(0, 34))
      : [...defaults];
  } catch { return [...defaults]; }
}

function encodedChoices() {
  return btoa(unescape(encodeURIComponent(JSON.stringify(choices))));
}

function draw() {
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 10;
  const step = (Math.PI * 2) / choices.length;
  context.clearRect(0, 0, size, size);
  context.save();
  context.translate(center, center);
  context.rotate(rotation - Math.PI / 2 - step / 2);

  choices.forEach((choice, index) => {
    const start = index * step;
    const end = start + step;
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, start, end);
    context.closePath();
    context.fillStyle = colors[index];
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.9)";
    context.lineWidth = 5;
    context.stroke();

    context.save();
    context.rotate(start + step / 2);
    context.translate(radius * .60, 0);
    context.rotate(Math.PI / 2);
    context.fillStyle = "#1f2937";
    context.font = "800 25px ui-rounded, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lines = wrapText(choice, 18);
    lines.forEach((line, lineIndex) => context.fillText(line, 0, (lineIndex - (lines.length - 1) / 2) * 29));
    context.restore();
  });
  context.restore();
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.strokeStyle = "#fffaf4";
  context.lineWidth = 10;
  context.stroke();
}

function wrapText(text, limit) {
  const words = text.split(/\s+/);
  const lines = [""];
  words.forEach((word) => {
    const candidate = `${lines.at(-1)} ${word}`.trim();
    if (candidate.length > limit && lines.at(-1)) lines.push(word);
    else lines[lines.length - 1] = candidate;
  });
  return lines.slice(0, 2);
}

function spin() {
  if (spinning) return;
  spinning = true;
  wheelButton.disabled = true;
  message.classList.remove("winner");
  message.textContent = "La roue tourne…";
  const step = (Math.PI * 2) / choices.length;
  const winner = Math.floor(Math.random() * choices.length);
  const current = rotation % (Math.PI * 2);
  const target = (Math.PI * 2 - winner * step) % (Math.PI * 2);
  const extra = Math.PI * 2 * (6 + Math.floor(Math.random() * 3));
  const delta = ((target - current + Math.PI * 2) % (Math.PI * 2)) + extra;
  const start = performance.now();
  const initial = rotation;
  const duration = 3900;

  function animate(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    rotation = initial + delta * eased;
    draw();
    if (progress < 1) requestAnimationFrame(animate);
    else {
      rotation = initial + delta;
      draw();
      message.textContent = `Le choix est : ${choices[winner]} !`;
      message.classList.add("winner");
      wheelButton.disabled = false;
      spinning = false;
    }
  }
  requestAnimationFrame(animate);
}

function renderFields() {
  fields.innerHTML = "";
  choices.forEach((choice, index) => {
    const label = document.createElement("label");
    label.innerHTML = `<span>${index + 1}</span><input required maxlength="34" value="${escapeHtml(choice)}" aria-label="Choix ${index + 1}">`;
    fields.append(label);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"})[char]);
}

document.querySelector("#configure-button").addEventListener("click", () => { renderFields(); dialog.showModal(); });
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#reset-button").addEventListener("click", () => { choices = [...defaults]; renderFields(); });
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const updated = [...fields.querySelectorAll("input")].map((input) => input.value.trim());
  if (updated.some((value) => !value)) return;
  choices = updated;
  history.replaceState({}, "", `${location.pathname}?c=${encodeURIComponent(encodedChoices())}`);
  rotation = 0;
  draw();
  message.classList.remove("winner");
  message.textContent = "Ta roue est prête. Copie le lien pour la partager.";
  dialog.close();
});
document.querySelector("#share-button").addEventListener("click", async () => {
  const link = `${location.origin}${location.pathname}?c=${encodeURIComponent(encodedChoices())}`;
  try { await navigator.clipboard.writeText(link); message.textContent = "Lien copié. Envoie-le à tes copains !"; }
  catch { window.prompt("Copie ce lien :", link); }
});
wheelButton.addEventListener("click", spin);
draw();
