import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGoogleAnalytics } from "@/lib/analytics";

initGoogleAnalytics();

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error('Root element #root was not found');
}

if (rootElement.hasChildNodes()) {
	hydrateRoot(rootElement, <App />);
} else {
	createRoot(rootElement).render(<App />);
}
