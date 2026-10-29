import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "@/app/globals.css";
import "@/app/studio.css";
import "@/app/focused.css";
import { createRouter } from "@/routes";

createRoot(document.getElementById("root")!).render(<StrictMode><RouterProvider router={createRouter()} /></StrictMode>);
