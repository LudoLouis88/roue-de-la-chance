const colors = ["#f45b69", "#f8a75d", "#f6d365", "#86cfa5", "#6cbcc1", "#8d94cf", "#d18ab8"];
const canvas = document.querySelector("#wheel");
const context = canvas.getContext("2d");
const wheelButton = document.querySelector("#wheel-button");
const message = document.querySelector("#message");
const adminView = document.querySelector("#admin-view");
const participantView = document.querySelector("#participant-view");
const subtitle = document.querySelector("#subtitle");
const params = new URLSearchParams(location.search);
let choices = [];
let rotation = 0;
let spinning = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
async function request(path, options = {}) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");
  return data;
}
function draw() {
  const size = canvas.width, center = size / 2, radius = center - 10, step = (Math.PI * 2) / choices.length;
  context.clearRect(0, 0, size, size); context.save(); context.translate(center, center); context.rotate(rotation - Math.PI / 2 - step / 2);
  choices.forEach((choice, index) => {
    const start = index * step;
    context.beginPath(); context.moveTo(0, 0); context.arc(0, 0, radius, start, start + step); context.closePath();
    context.fillStyle = colors[index]; context.fill(); context.strokeStyle = "rgba(255,255,255,.9)"; context.lineWidth = 5; context.stroke();
    context.save(); context.rotate(start + step / 2); context.translate(radius * .60, 0); context.rotate(Math.PI / 2);
    context.fillStyle = "#1f2937"; context.font = "800 25px ui-rounded, system-ui, sans-serif"; context.textAlign = "center"; context.textBaseline = "middle";
    wrapText(choice, 18).forEach((line, lineIndex, lines) => context.fillText(line, 0, (lineIndex - (lines.length - 1) / 2) * 29)); context.restore();
  });
  context.restore(); context.beginPath(); context.arc(center, center, radius, 0, Math.PI * 2); context.strokeStyle = "#fffaf4"; context.lineWidth = 10; context.stroke();
}
function wrapText(text, limit) {
  const lines = [""];
  text.split(/\s+/).forEach((word) => { const candidate = `${lines.at(-1)} ${word}`.trim(); if (candidate.length > limit && lines.at(-1)) lines.push(word); else lines[lines.length - 1] = candidate; });
  return lines.slice(0, 2);
}
function spinTo(winner) {
  const index = choices.indexOf(winner), step = (Math.PI * 2) / choices.length, target = (Math.PI * 2 - index * step) % (Math.PI * 2);
  const delta = ((target - (rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) + Math.PI * 2 * 7, start = performance.now(), initial = rotation;
  return new Promise((resolve) => {
    function animate(now) { const progress = Math.min((now - start) / 3900, 1); rotation = initial + delta * (1 - Math.pow(1 - progress, 4)); draw(); if (progress < 1) requestAnimationFrame(animate); else { rotation = initial + delta; draw(); resolve(); } }
    requestAnimationFrame(animate);
  });
}
function choiceInputs(values) {
  return values.map((choice, index) => `<label><span>${index + 1}</span><input required maxlength="34" value="${escapeHtml(choice)}" aria-label="Choix ${index + 1}">${values.length > 2 ? `<button class="remove-choice" type="button" data-index="${index}" aria-label="Supprimer le choix ${index + 1}">×</button>` : ""}</label>`).join("");
}
function enableChoiceEditor(root, initial) {
  let values = [...initial]; const fields = root.querySelector(".choice-fields");
  function redraw() {
    fields.innerHTML = choiceInputs(values);
    fields.querySelectorAll("input").forEach((input, index) => input.addEventListener("input", () => { values[index] = input.value; }));
    fields.querySelectorAll(".remove-choice").forEach((button) => button.addEventListener("click", () => { values.splice(Number(button.dataset.index), 1); redraw(); }));
    root.querySelector(".add-choice").disabled = values.length >= 7;
  }
  root.querySelector(".add-choice").addEventListener("click", () => { if (values.length < 7) { values.push(`Choix ${values.length + 1}`); redraw(); } }); redraw();
  return () => values.map((value) => value.trim());
}
function renderCreate() {
  adminView.hidden = false;
  adminView.innerHTML = `<div class="admin-card"><p class="eyebrow">CONSOLE ADMIN</p><h2>Crée ta session</h2><p class="panel-copy">Pour un grand groupe, choisis le lien collectif anonyme : chaque navigateur ne pourra tirer qu'une seule fois.</p><form id="create-form"><label class="field-label">Titre <input name="title" maxlength="80" value="La roue de la chance"></label><label class="field-label">Mode de participation <select name="mode"><option value="anonymous" selected>Lien collectif anonyme (recommandé)</option><option value="individual">Un lien différent par participant</option></select></label><label class="field-label">Nombre de participants prévus <input name="participantCount" type="number" min="1" max="80" value="50" required></label><p class="field-label">Choix (2 à 7)</p><div class="choice-fields"></div><button class="secondary-button add-choice" type="button">+ Ajouter un choix</button><button class="primary-button full-button" type="submit">Créer la session</button><p class="form-error" aria-live="polite"></p></form></div>`;
  const form = adminView.querySelector("form"), getChoices = enableChoiceEditor(form, ["Choix 1", "Choix 2"]);
  form.addEventListener("submit", async (event) => { event.preventDefault(); const error = form.querySelector(".form-error"); error.textContent = ""; try { const data = await request("/api/sessions", { method: "POST", body: JSON.stringify({ title: form.title.value, mode: form.mode.value, participantCount: Number(form.participantCount.value), choices: getChoices() }) }); const url = new URL(data.adminUrl); location.assign(`${url.pathname}${url.search}`); } catch (err) { error.textContent = err.message; } });
}
function tally(session) { return session.choices.map((choice) => ({ choice, count: session.participants.filter((participant) => participant.result === choice).length })); }
function renderAdmin(data) {
  const { session, adminUrl, publicUrl, participantLinks } = data;
  const anonymous = session.mode === "anonymous", started = session.participants.some((participant) => participant.result), results = tally(session), target = session.participantCount || session.participants.length;
  adminView.hidden = false; subtitle.textContent = session.title;
  const participantBlock = anonymous ? `<h3>Lien à partager</h3><div class="admin-link"><input readonly value="${escapeHtml(publicUrl || "")}"><button class="secondary-button copy-button" data-copy="${escapeHtml(publicUrl || "")}">Copier le lien collectif</button></div><p class="reset-copy">Chaque navigateur est reconnu anonymement par un cookie technique. Aucun nom ni compte n'est demandé.</p>` : `<h3>Liens participants</h3><div class="participant-links">${participantLinks.map((item, index) => `<article><div><strong>${escapeHtml(item.label)}</strong><small>${session.participants[index].result ? `Résultat : ${escapeHtml(session.participants[index].result)}` : "En attente"}</small></div><button class="text-button copy-button" data-copy="${escapeHtml(item.url)}">Copier le lien</button></article>`).join("")}</div>`;
  adminView.innerHTML = `<div class="admin-grid"><section class="admin-card"><p class="eyebrow">CONSOLE ADMIN</p><h2>Ta session</h2><p class="panel-copy">Garde ce lien privé : il donne accès aux résultats et à la configuration.</p><div class="admin-link"><input readonly value="${escapeHtml(adminUrl)}"><button class="secondary-button copy-button" data-copy="${escapeHtml(adminUrl)}">Copier mon lien admin</button></div><form id="settings-form" class="settings-form"><label class="field-label">Titre <input name="title" maxlength="80" value="${escapeHtml(session.title)}" ${started ? "disabled" : ""}></label><p class="field-label">Choix (2 à 7)</p><div class="choice-fields"></div><button class="secondary-button add-choice" type="button" ${started ? "disabled" : ""}>+ Ajouter un choix</button>${started ? `<p class="locked-note">Les choix sont verrouillés depuis le premier tirage.</p>` : `<button class="primary-button full-button" type="submit">Enregistrer les choix</button>`}<p class="form-error" aria-live="polite"></p></form></section><section class="admin-card"><p class="eyebrow">RÉSULTATS</p><h2>${session.participants.filter((p) => p.result).length} / ${target} ont tiré</h2><div class="result-bars">${results.map((item) => `<div><span>${escapeHtml(item.choice)}</span><strong>${item.count}</strong><i style="width:${target ? item.count / target * 100 : 0}%"></i></div>`).join("")}</div><button id="reset-round" class="secondary-button full-button" type="button">Démarrer une nouvelle manche</button><p class="reset-copy">${anonymous ? "Les résultats seront effacés ; le même lien pourra servir pour la nouvelle manche." : "Les résultats seront effacés et de nouveaux liens personnels seront générés."}</p>${participantBlock}</section></div>`;
  adminView.querySelectorAll(".copy-button").forEach((button) => button.addEventListener("click", async () => { await navigator.clipboard.writeText(button.dataset.copy); const original = button.textContent; button.textContent = "Copié !"; setTimeout(() => { button.textContent = original; }, 1300); }));
  adminView.querySelector("#reset-round").addEventListener("click", async () => {
    if (!window.confirm("Commencer une nouvelle manche ? Les résultats actuels seront effacés.")) return;
    try { await request(`/api/sessions/${session.id}/reset?token=${encodeURIComponent(params.get("admin"))}`, { method: "POST" }); await loadAdmin(); }
    catch (error) { window.alert(error.message); }
  });
  if (!started) { const form = adminView.querySelector("#settings-form"), getChoices = enableChoiceEditor(form, session.choices); form.addEventListener("submit", async (event) => { event.preventDefault(); try { await request(`/api/sessions/${session.id}/admin?token=${encodeURIComponent(params.get("admin"))}`, { method: "PUT", body: JSON.stringify({ title: form.title.value, choices: getChoices() }) }); await loadAdmin(); } catch (err) { form.querySelector(".form-error").textContent = err.message; } }); }
}
async function loadAdmin() { try { renderAdmin(await request(`/api/sessions/${params.get("session")}/admin?token=${encodeURIComponent(params.get("admin"))}`)); } catch (error) { renderError(error.message); } }
function renderError(text) { adminView.hidden = false; adminView.innerHTML = `<div class="admin-card"><h2>Oups</h2><p class="panel-copy">${escapeHtml(text)}</p><a class="primary-button" href="/">Créer une nouvelle roue</a></div>`; }
async function loadParticipant() {
  try {
    const sessionId = params.get("session"), participantId = params.get("participant"), data = await request(`/api/sessions/${sessionId}/participant/${participantId}`);
    participantView.hidden = false; subtitle.textContent = data.title; choices = data.choices; draw(); document.querySelector("#participant-label").textContent = data.participant.label;
    if (data.participant.result) { wheelButton.disabled = true; message.textContent = `Ton tirage est déjà enregistré : ${data.participant.result}.`; message.classList.add("winner"); return; }
    message.textContent = "Tu as un seul tirage : appuie quand tu es prêt·e.";
    wheelButton.addEventListener("click", async () => { if (spinning) return; spinning = true; wheelButton.disabled = true; message.textContent = "La roue tourne…"; try { const result = await request(`/api/sessions/${sessionId}/spin/${participantId}`, { method: "POST" }); await spinTo(result.participant.result); message.textContent = `Ton choix est : ${result.participant.result} !`; message.classList.add("winner"); } catch (error) { message.textContent = error.message; wheelButton.disabled = false; spinning = false; } });
  } catch (error) { participantView.hidden = false; message.textContent = error.message; }
}
async function loadAnonymous() {
  try {
    const sessionId = params.get("session"), token = params.get("public"), data = await request(`/api/sessions/${sessionId}/public?token=${encodeURIComponent(token)}`);
    participantView.hidden = false; subtitle.textContent = data.title; choices = data.choices; draw(); document.querySelector("#participant-label").textContent = "Tirage anonyme";
    if (data.participant.result) { wheelButton.disabled = true; message.textContent = `Ton tirage est déjà enregistré : ${data.participant.result}.`; message.classList.add("winner"); return; }
    if (data.full) { wheelButton.disabled = true; message.textContent = "Cette manche est complète."; return; }
    message.textContent = "Tu as un seul tirage : appuie quand tu es prêt·e.";
    wheelButton.addEventListener("click", async () => { if (spinning) return; spinning = true; wheelButton.disabled = true; message.textContent = "La roue tourne…"; try { const result = await request(`/api/sessions/${sessionId}/public/spin?token=${encodeURIComponent(token)}`, { method: "POST" }); await spinTo(result.participant.result); message.textContent = `Ton choix est : ${result.participant.result} !`; message.classList.add("winner"); } catch (error) { message.textContent = error.message; wheelButton.disabled = false; spinning = false; } });
  } catch (error) { participantView.hidden = false; message.textContent = error.message; }
}
if (params.has("admin") && params.has("session")) loadAdmin();
else if (params.has("public") && params.has("session")) loadAnonymous();
else if (params.has("participant") && params.has("session")) loadParticipant();
else renderCreate();
