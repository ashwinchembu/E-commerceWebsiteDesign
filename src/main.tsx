import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// Start the jacket's model and decoder requests before React mounts. Using
// fetch with same-origin credentials matches Three.js exactly, so Safari
// coalesces/reuses the requests instead of downloading unused preloads.
[
  "/models/varsitybase/VarsityBase.glb",
  "/draco/draco_wasm_wrapper.js",
  "/draco/draco_decoder.wasm",
].forEach((asset) => {
  void fetch(asset, { credentials: "same-origin", cache: "force-cache" }).catch(() => undefined);
});

createRoot(document.getElementById("root")!).render(<App />);
