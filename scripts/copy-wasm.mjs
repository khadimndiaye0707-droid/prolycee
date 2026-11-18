// Copie le moteur IFC (web-ifc.wasm) dans public/ pour que le site puisse le charger.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
const src = "node_modules/web-ifc/web-ifc.wasm";
if (existsSync(src)) { mkdirSync("public", { recursive: true }); copyFileSync(src, "public/web-ifc.wasm"); console.log("web-ifc.wasm copié dans public/"); }
else console.warn("web-ifc.wasm introuvable (npm install ?)");
