import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

// ⚠️ `vite`, `../vite.config` (qui tire @vitejs/plugin-react) et `nanoid` ne
// sont chargés QUE dans setupVite(), via import() dynamique.
//
// Ils étaient importés statiquement ici, et `createLogger()` était même appelé
// au chargement du module. Or index.ts importe ce fichier inconditionnellement
// (pour `log` et `serveStatic`), et `vite` / `@vitejs/plugin-react` sont des
// devDependencies — absentes de l'image Docker (`npm ci --only=production`).
// Le bundle de production échouait donc dès son chargement sur
// « Cannot find package 'vite' », avant l'exécution de la moindre ligne.
// (`nanoid` n'est déclaré ni en dependencies ni en devDependencies : il ne
// résolvait que par transitivité.)
//
// setupVite() n'est appelée que si app.get("env") === "development" : en
// production ces modules ne sont jamais atteints.

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Chargement paresseux : voir la note en tête de fichier.
  const { createServer: createViteServer, createLogger } = await import("vite");
  const { nanoid } = await import("nanoid");
  const viteLogger = createLogger();

  // On laisse Vite charger vite.config.ts lui-même plutôt que de l'importer.
  // Un `import("../vite.config")` est un chemin RELATIF : esbuild l'inline dans
  // le bundle au lieu de le laisser dynamique, ce qui y réintroduit `vite` et
  // `@vitejs/plugin-react` comme imports statiques — et casse à nouveau la
  // production. Le résultat fonctionnel est identique : c'est le même fichier,
  // simplement résolu par Vite au lieu du bundler.
  const configFile = path.resolve(import.meta.dirname, "..", "vite.config.ts");

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    configFile,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
