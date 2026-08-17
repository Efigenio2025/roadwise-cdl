import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Roadwise from "./app/page";
import "./app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Roadwise />
  </StrictMode>,
);
