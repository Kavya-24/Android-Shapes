const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const qInput = $("#q");
const hexInput = $("#hex");
const colorInput = $("#color");
const root = document.documentElement;

let manifest = { entries: [], cap: 250, count: 0 };
let view = [];
let rendered = 0;
let shardCache = new Map();
let activeFam = "all";
let currentShape = null;
let currentTab = "svg";
const CHUNK = 96;
const PRESET = ["#D0BCFF", "#6750A4", "#FFB4AB", "#4DB6AC", "#F06292", "#BA68C8", "#81C784", "#FDD835", "#EF5350", "#42A5F5"];

function rss() { return document.createDocumentFragment(); }

async function load() {
  const res = await fetch("../data/manifest.json");
  manifest = await res.json();
  $("#meta").textContent = `${manifest.count.toLocaleString()} shapes · ${manifest.families.length} families`;
  const chips = $("#chips");
  const frag = rss();
  for (const fam of ["all", ...manifest.families]) {
    const b = document.createElement("button");
    b.className = "chip" + (fam === "all" ? " on" : "");
    b.textContent = fam;
    b.dataset.fam = fam;
    b.onclick = () => {
      activeFam = fam;
      chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
      applyFilter();
    };
    frag.appendChild(b);
  }
  chips.appendChild(frag);
  const sw = $("#swatches");
  const f2 = rss();
  for (const c of PRESET) {
    const b = document.createElement("button");
    b.className = "sw";
    b.style.background = c;
    b.dataset.hex = c;
    b.title = c;
    b.onclick = () => setColor(c);
    f2.appendChild(b);
  }
  sw.appendChild(f2);
  applyFilter();
}

async function shardData(i) {
  const idx = Math.floor(i / manifest.cap);
  if (!shardCache.has(idx)) {
    const name = `shard-${String(idx).padStart(4, "0")}.json`;
    shardCache.set(idx, fetch(`../data/shards/${name}`).then((r) => r.json()));
  }
  const arr = await shardCache.get(idx);
  return arr[Math.floor(i % manifest.cap)];
}

function matches(e, q) {
  const hay = e.id + " " + e.t;
  for (const tok of q) {
    if (!(e.id.toLowerCase().includes(tok) || e.t.includes(tok))) return false;
  }
  return true;
}

function applyFilter() {
  const raw = qInput.value.trim().toLowerCase();
  const q = raw ? raw.split(/\s+/) : [];
  view = manifest.entries.filter(
    (e) => (activeFam === "all" || e.f === activeFam) && matches(e, q)
  );
  grid.innerHTML = "";
  rendered = 0;
  $("#empty").classList.toggle("hidden", view.length > 0);
  $("#shown").textContent = `${view.length.toLocaleString()} shapes${raw ? ` matching “${raw}”` : ""}`;
  appendChunk();
}

let io = null;
function ensureObserver() {
  if (io) return;
  io = new IntersectionObserver((ents) => {
    if (ents.some((en) => en.isIntersecting)) appendChunk();
  }, { rootMargin: "800px" });
  io.observe($("#sentinel"));
}

function appendChunk() {
  const end = Math.min(view.length, rendered + CHUNK);
  if (rendered >= end) return;
  const frag = rss();
  for (let k = rendered; k < end; k++) {
    const e = view[k];
    const t = document.createElement("button");
    t.className = "tile";
    t.dataset.i = e.i;
    t.title = e.id;
    t.innerHTML = `<svg viewBox="0 0 200 200"><path d=""/></svg>`;
    t.onclick = () => openShape(e);
    frag.appendChild(t);
  }
  grid.appendChild(frag);
  const added = [];
  for (let k = rendered; k < end; k++) added.push(view[k]);
  rendered = end;
  ensureObserver();
  Promise.allSettled(added.map((e) => shardData(e.i).then((s) => {
    const tile = grid.querySelector(`.tile[data-i="${s.i}"] path`);
    if (tile) tile.setAttribute("d", s.d);
  })));
}

function setColor(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  hexInput.value = hex.toUpperCase();
  colorInput.value = hex;
  root.style.setProperty("--hex", hex);
  document.querySelectorAll(".sw").forEach((b) => b.classList.toggle("on", b.dataset.hex.toUpperCase() === hex.toUpperCase()));
  return true;
}

hexInput.addEventListener("input", () => setColor(hexInput.value.trim()));
colorInput.addEventListener("input", () => setColor(colorInput.value));
$("#rnd").onclick = () => {
  const h = "#" + [0, 0, 0].map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
  setColor(h);
};
$("#bg").onclick = () => document.body.classList.toggle("light");

let debounce;
qInput.addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(applyFilter, 140);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== qInput && !$("#modal").matches(":not(.hidden)")) {
    e.preventDefault();
    qInput.focus();
  }
  if (e.key === "Escape") closeModal();
});

const hex = () =>
  /^#[0-9a-fA-F]{6}$/.test(hexInput.value) ? hexInput.value.toUpperCase() : "#D0BCFF";

function svgOf(d) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><path d="${d}" fill="${hex()}"/></svg>`;
}

function xmlOf(d) {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="200dp"
    android:height="200dp"
    android:viewportWidth="200"
    android:viewportHeight="200">
    <path
        android:fillColor="${hex()}"
        android:pathData="${d}"/>
</vector>`;
}

function composeOf(d) {
  return `import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

@Composable
fun ${shapeName()}(modifier: Modifier = Modifier) {
    Canvas(modifier.size(100.dp)) {
        scale(size.width / 200f, size.height / 200f) {
            drawPath(
                path = PathParser().parsePathString("${d}").toPath(),
                color = Color(0xFF${hex().slice(1)}),
            )
        }
    }
}`;
}

let modalD = null;
function shapeName() {
  const base = currentShape.id.split("-")[0];
  return base.charAt(0).toUpperCase() + base.slice(1) + currentShape.id.split("-")[1];
}

function openShape(e) {
  currentShape = e;
  currentTab = "svg";
  $("#modal").classList.remove("hidden");
  $("#mid").textContent = e.id;
  $("#mtags").textContent = e.t.replaceAll("|", "  ·  ");
  modalD = null;
  shardData(e.i).then((s) => {
    modalD = s.d;
    $("#big").innerHTML = `<svg viewBox="0 0 200 200"><path d="${s.d}"/></svg>`;
    renderCode();
    dlLinks();
  });
}
function closeModal() {
  $("#modal").classList.add("hidden");
  currentShape = null;
}

document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    currentTab = b.dataset.t;
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
    renderCode();
  })
);

function codeOf() {
  if (!modalD || !currentShape) return "";
  if (currentTab === "svg") return svgOf(modalD);
  if (currentTab === "xml") return xmlOf(modalD);
  if (currentTab === "compose") return composeOf(modalD);
  return modalD;
}

function renderCode() {
  $("#code").textContent = codeOf();
}

async function dlLinks() {
  const blobSvg = new Blob([svgOf(modalD)], { type: "image/svg+xml" });
  $("#dlSvg").href = URL.createObjectURL(blobSvg);
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  ctx.scale(2.56, 2.56);
  ctx.fillStyle = hex();
  ctx.fill(new Path2D(modalD));
  $("#dlPng").href = c.toDataURL("image/png");
}

$("#copy").onclick = async () => {
  const txt = codeOf();
  try {
    await navigator.clipboard.writeText(txt);
    flash("Copied ✓");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    flash("Copied ✓");
  }
};
function flash(msg) {
  const b = $("#copy");
  const old = b.textContent;
  b.textContent = msg;
  setTimeout(() => (b.textContent = old), 900);
}

$("#close").onclick = closeModal;
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) closeModal();
});

load();
