import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import "./styles/global.css";
import "./styles/landing.css";
import { registerTBudTools } from "./webmcp/register";

const root = document.getElementById("root");

if (!root) {
  throw new Error("T-Bud root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

void registerTBudTools();
