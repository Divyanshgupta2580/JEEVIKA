import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./design-system/tokens.css";
import "./design-system/erp.css";
import "./design-system/landing-public.css";
import "./design-system/selects.css";
import "./design-system/motion.css";

const { hash, pathname, search } = window.location;
if (!hash && /^\/(?:overview\/?|kiosk\/?|home\/(?:sign-in|register|reset-password)\/?|app(?:\/.*)?|login\/?|register\/?|reset-password\/?)$/.test(pathname)) {
  window.history.replaceState(window.history.state, "", `/#${pathname.replace(/\/$/, "")}${search}`);
}

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <div className="ayu-erp">
      <App />
    </div>,
  );
