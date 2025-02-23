import type { NextConfig } from "next";

// cron.ts
import cron from "node-cron";

// Planifiez une tâche pour s'exécuter toutes les minutes
cron.schedule("* * * * *", () => {
  // console.log("Cron job exécuté à:", new Date().toISOString());
  // Ajoutez ici la logique de votre tâche
});

console.log("Cron job configuré");

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        hostname: "**"
      }
    ]
  },
};

export default nextConfig;
