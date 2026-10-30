import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
// Fonts are bundled with the app (no requests to third-party font services).
import "@fontsource-variable/geist";
import "@/app/globals.css";
import "@/app/studio.css";
import "@/app/focused.css";
import "@/app/navigation.css";
import "@/app/layout.css";
import "@/app/theme.css";
import "@/app/polish.css";
import { createRouter } from "@/routes";

createRoot(document.getElementById("root")!).render(<StrictMode><RouterProvider router={createRouter()} /></StrictMode>);
