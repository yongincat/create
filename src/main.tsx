import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { loadConfig } from "./lib/config";
import "./styles.css";

async function bootstrap() {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing root element");

  await loadConfig();

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
