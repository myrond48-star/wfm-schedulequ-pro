import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.use((req, res, next) => {
    console.log(`REQ: ${req.method} ${req.url}`);
    next();
  });
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy to expose secrets securely to client
  app.get("/api/config", (req, res) => {
    console.log('DEBUG SERVER: VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
    console.log('DEBUG SERVER: VITE_SUPABASE_KEY:', process.env.VITE_SUPABASE_KEY ? '***PRESENT***' : '***MISSING***');
    
    res.json({
        url: process.env.VITE_SUPABASE_URL || "",
        key: process.env.VITE_SUPABASE_KEY || ""
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
