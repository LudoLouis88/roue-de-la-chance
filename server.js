const http = require("node:http");
const { readFile, writeFile, mkdir, stat } = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const port = Number(process.env.PORT || 3000);
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const dataFile = path.join(dataDir, "wheels.json");
const publicDir = __dirname;
let writeQueue = Promise.resolve();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function id() { return crypto.randomUUID().replaceAll("-", ""); }
function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}
function fail(res, status, message) { send(res, status, { error: message }); }
function normaliseChoices(choices) {
  if (!Array.isArray(choices) || choices.length < 2 || choices.length > 7) return null;
  const cleaned = choices.map((choice) => String(choice || "").trim().slice(0, 34));
  return cleaned.every(Boolean) ? cleaned : null;
}
async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 40_000) throw new Error("Requête trop grande");
  }
  try { return body ? JSON.parse(body) : {}; }
  catch { throw new Error("Données invalides"); }
}
async function readStore() {
  try { return JSON.parse(await readFile(dataFile, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return { sessions: {} };
    throw error;
  }
}
async function mutate(mutator) {
  const task = writeQueue.then(async () => {
    const store = await readStore();
    const result = await mutator(store);
    await mkdir(dataDir, { recursive: true });
    const temporary = `${dataFile}.tmp`;
    await writeFile(temporary, JSON.stringify(store, null, 2), "utf8");
    await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
    return result;
  });
  writeQueue = task.catch(() => {});
  return task;
}
function getAdminSession(store, sessionId, token) {
  const session = store.sessions[sessionId];
  return session && crypto.timingSafeEqual(Buffer.from(session.adminToken), Buffer.from(String(token || "").padEnd(session.adminToken.length, " ").slice(0, session.adminToken.length))) ? session : null;
}
function publicSession(session) {
  return {
    id: session.id,
    title: session.title,
    choices: session.choices,
    createdAt: session.createdAt,
    participants: session.participants.map((participant) => ({
      label: participant.label,
      result: participant.result,
      playedAt: participant.playedAt,
    })),
  };
}
function participantLink(req, session, participant) {
  const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const origin = `${protocol}://${req.headers.host}`;
  return `${origin}/?session=${session.id}&participant=${participant.id}`;
}
function adminLink(req, session) {
  const protocol = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const origin = `${protocol}://${req.headers.host}`;
  return `${origin}/?session=${session.id}&admin=${session.adminToken}`;
}
async function api(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[1] !== "sessions") return false;
  const sessionId = parts[2];

  if (req.method === "POST" && parts.length === 2) {
    const body = await readJson(req);
    const choices = normaliseChoices(body.choices);
    const count = Number(body.participantCount);
    if (!choices) return fail(res, 400, "Il faut entre 2 et 7 choix.");
    if (!Number.isInteger(count) || count < 1 || count > 80) return fail(res, 400, "Le nombre de participants doit être compris entre 1 et 80.");
    const session = await mutate((store) => {
      const created = {
        id: id(), adminToken: id(), title: String(body.title || "La roue de la chance").trim().slice(0, 80) || "La roue de la chance",
        choices, createdAt: new Date().toISOString(),
        participants: Array.from({ length: count }, (_, index) => ({ id: id(), label: `Participant ${index + 1}`, result: null, playedAt: null })),
      };
      store.sessions[created.id] = created;
      return created;
    });
    return send(res, 201, { session: publicSession(session), adminUrl: adminLink(req, session), participantLinks: session.participants.map((p) => ({ label: p.label, url: participantLink(req, session, p) })) });
  }

  if (!sessionId) return fail(res, 404, "Session introuvable.");
  if (req.method === "GET" && parts[3] === "admin") {
    const store = await readStore();
    const session = getAdminSession(store, sessionId, url.searchParams.get("token"));
    return session ? send(res, 200, { session: publicSession(session), adminUrl: adminLink(req, session), participantLinks: session.participants.map((p) => ({ label: p.label, url: participantLink(req, session, p) })) }) : fail(res, 403, "Accès administrateur refusé.");
  }
  if (req.method === "PUT" && parts[3] === "admin") {
    const body = await readJson(req);
    const choices = normaliseChoices(body.choices);
    if (!choices) return fail(res, 400, "Il faut entre 2 et 7 choix.");
    const session = await mutate((store) => {
      const current = getAdminSession(store, sessionId, url.searchParams.get("token"));
      if (!current) return null;
      if (current.participants.some((participant) => participant.result)) return "started";
      current.choices = choices;
      current.title = String(body.title || current.title).trim().slice(0, 80) || current.title;
      return current;
    });
    if (!session) return fail(res, 403, "Accès administrateur refusé.");
    if (session === "started") return fail(res, 409, "Les choix ne peuvent plus changer après le premier tirage.");
    return send(res, 200, { session: publicSession(session) });
  }
  if (req.method === "POST" && parts[3] === "reset") {
    const session = await mutate((store) => {
      const current = getAdminSession(store, sessionId, url.searchParams.get("token"));
      if (!current) return null;
      current.round = (current.round || 1) + 1;
      current.participants.forEach((participant) => {
        participant.id = id();
        participant.result = null;
        participant.playedAt = null;
      });
      return current;
    });
    if (!session) return fail(res, 403, "Accès administrateur refusé.");
    return send(res, 200, { session: publicSession(session), adminUrl: adminLink(req, session), participantLinks: session.participants.map((p) => ({ label: p.label, url: participantLink(req, session, p) })) });
  }
  if (req.method === "GET" && parts[3] === "participant" && parts[4]) {
    const store = await readStore();
    const session = store.sessions[sessionId];
    const participant = session?.participants.find((item) => item.id === parts[4]);
    return participant ? send(res, 200, { title: session.title, choices: session.choices, participant: { label: participant.label, result: participant.result, playedAt: participant.playedAt } }) : fail(res, 404, "Lien participant invalide.");
  }
  if (req.method === "POST" && parts[3] === "spin" && parts[4]) {
    const session = await mutate((store) => {
      const current = store.sessions[sessionId];
      const participant = current?.participants.find((item) => item.id === parts[4]);
      if (!participant) return null;
      if (!participant.result) {
        participant.result = current.choices[crypto.randomInt(current.choices.length)];
        participant.playedAt = new Date().toISOString();
      }
      return { title: current.title, choices: current.choices, participant };
    });
    return session ? send(res, 200, { title: session.title, choices: session.choices, participant: { label: session.participant.label, result: session.participant.result, playedAt: session.participant.playedAt } }) : fail(res, 404, "Lien participant invalide.");
  }
  return fail(res, 404, "Route introuvable.");
}
async function serveStatic(req, res, pathname) {
  const target = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(publicDir, target);
  if (!file.startsWith(publicDir) || !["index.html", "app.js", "styles.css"].includes(path.basename(file))) return fail(res, 404, "Introuvable.");
  try {
    await stat(file);
    res.writeHead(200, { "content-type": contentTypes[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(await readFile(file));
  } catch { fail(res, 404, "Introuvable."); }
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return api(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (error) { console.error(error); return fail(res, 500, "Erreur serveur."); }
}).listen(port, "0.0.0.0", () => console.log(`Wheel server listening on ${port}`));
