import { createRoot } from "react-dom/client";
import App from "./App";
import { LandingBoot } from "./components/JeevikaLoading";
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
const entryRoute = window.location.hash.startsWith("#/")
  ? window.location.hash.slice(1).split("?")[0]
  : pathname === "/erp.html" ? "/" : pathname;
const landingEntry = ["/", "/overview", "/landing"].includes(entryRoute.replace(/\/$/, "") || "/");
if (root)
  createRoot(root).render(
    <div className="ayu-erp">
      {landingEntry ? <LandingBoot><App /></LandingBoot> : <App />}
    </div>,
  );
