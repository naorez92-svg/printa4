import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import CompassApp from "./compass/CompassApp";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CompassApp />
  </StrictMode>
);
