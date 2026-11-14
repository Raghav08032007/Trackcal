import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
// Fonts are bundled with the app (no requests to third-party font services).
import "@fontsource-variable/dm-sans";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@/app/globals.css";
import "@/app/studio.css";
import "@/app/focused.css";
import "@/app/navigation.css";
import "@/app/layout.css";
import "@/app/theme.css";
import "@/app/polish.css";
import "@/app/clay.css";
import "@/app/refine.css";
import "@/app/vibe.css";
import "@/app/ds.css";
import "@/app/foundation.css";   // one font, palette and button look for every page
import "@/app/vivid.css";        // section colours and the type pair
import "@/app/motion.css";       // last: colour transitions, presses, depth and the footer
import "@/app/joy.css";          // after motion: a colour for every tab and card, rewarding feedback
import { createRouter } from "@/routes";

createRoot(document.getElementById("root")!).render(<StrictMode><RouterProvider router={createRouter()} /></StrictMode>);
