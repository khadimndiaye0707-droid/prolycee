// ── Médias des quiz : envoi vers Supabase Storage, images/PDF → image légère, IFC → GLB (3D) ──
import { supabase } from "./supabase";

const BUCKET = "quiz-media";
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "fichier";

export async function uploadMedia(blob, name, contentType) {
  const path = `${new Date().toISOString().slice(0, 10)}/${Math.random().toString(36).slice(2, 8)}-${slug(name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error(error.message.includes("not found") ? "Espace de stockage introuvable : relance le script SQL dans Supabase." : error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function canvasToBlob(canvas, type = "image/webp", quality = 0.9) {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Conversion d'image impossible"))), type, quality));
}

// Image (PNG/JPG/WebP) réduite à 2400 px max pour rester fluide sur téléphone
export async function imageToBlob(file, maxDim = 2400) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return canvasToBlob(c);
}

// Une page de PDF (plan) → image
export async function pdfToBlob(file, pageNum = 1, targetWidth = 2400) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await pdf.getPage(Math.min(Math.max(1, pageNum), pdf.numPages));
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(4, targetWidth / base.width) });
  const c = document.createElement("canvas"); c.width = Math.round(viewport.width); c.height = Math.round(viewport.height);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport, canvas: c }).promise;
  return canvasToBlob(c);
}

// ── IFC → scène Three.js : une maille par couleur (peu d'objets = fluide sur téléphone) ──
export async function ifcBytesToScene(bytes, { wasmPath, THREE, WebIFC, onProgress } = {}) {
  const T = THREE || (await import("three"));
  const W = WebIFC || (await import("web-ifc"));
  const api = new W.IfcAPI();
  api.SetWasmPath(wasmPath, true);
  await api.Init();
  const model = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: true });
  const groups = new Map();
  const m4 = new T.Matrix4(), n3 = new T.Matrix3(), v = new T.Vector3();
  api.StreamAllMeshes(model, (mesh, i, total) => {
    if (onProgress) onProgress(total ? (i + 1) / total : 0);
    const list = mesh.geometries;
    for (let k = 0; k < list.size(); k++) {
      const pg = list.get(k); const c = pg.color;
      const key = [c.x, c.y, c.z, c.w].map((n) => n.toFixed(3)).join("_");
      let g = groups.get(key);
      if (!g) { g = { color: [c.x, c.y, c.z, c.w], pos: [], nor: [], idx: [], count: 0 }; groups.set(key, g); }
      const geom = api.GetGeometry(model, pg.geometryExpressID);
      const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
      const index = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
      m4.fromArray(pg.flatTransformation); n3.getNormalMatrix(m4);
      const base = g.count;
      for (let p = 0; p < verts.length; p += 6) {
        v.set(verts[p], verts[p + 1], verts[p + 2]).applyMatrix4(m4); g.pos.push(v.x, v.y, v.z);
        v.set(verts[p + 3], verts[p + 4], verts[p + 5]).applyMatrix3(n3).normalize(); g.nor.push(v.x, v.y, v.z);
      }
      for (let p = 0; p < index.length; p++) g.idx.push(index[p] + base);
      g.count += verts.length / 6;
      geom.delete();
    }
  });
  api.CloseModel(model);
  const scene = new T.Group();
  for (const g of groups.values()) {
    const bg = new T.BufferGeometry();
    bg.setAttribute("position", new T.Float32BufferAttribute(g.pos, 3));
    bg.setAttribute("normal", new T.Float32BufferAttribute(g.nor, 3));
    bg.setIndex(g.idx);
    const [r, gr, b, a] = g.color;
    scene.add(new T.Mesh(bg, new T.MeshStandardMaterial({ color: new T.Color(r, gr, b), transparent: a < 1, opacity: a, side: T.DoubleSide, roughness: 0.85, metalness: 0 })));
  }
  return scene;
}

// Fichier IFC → GLB (binaire) prêt à être envoyé
export async function ifcToGlb(file, onProgress) {
  const [THREE, WebIFC, { GLTFExporter }] = await Promise.all([
    import("three"), import("web-ifc"), import("three/examples/jsm/exporters/GLTFExporter.js"),
  ]);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const scene = await ifcBytesToScene(bytes, { wasmPath: `${window.location.origin}/`, THREE, WebIFC, onProgress });
  if (scene.children.length === 0) throw new Error("Aucune géométrie trouvée dans ce fichier IFC.");
  const buf = await new GLTFExporter().parseAsync(scene, { binary: true });
  return new Blob([buf], { type: "model/gltf-binary" });
}
