import { createRoot } from "react-dom/client";
import App from "./App";
// Polices auto-hébergées, sous-ensemble latin uniquement (il couvre les
// accents français, « œ », « € » et les guillemets). Les autres graisses ne
// sont pas chargées : chaque fichier en plus alourdit la première page.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-serif/latin-400.css";
import "@fontsource/ibm-plex-serif/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
