import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

const rootEl = document.getElementById('root');
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!rootEl) {
  throw new Error('Missing root element');
}

if (!convexUrl) {
  rootEl.innerHTML = `
    <div style="font-family: Inter, Arial, sans-serif; padding: 24px; line-height: 1.5;">
      <h1 style="margin: 0 0 12px; font-size: 20px;">Configuration Error</h1>
      <p style="margin: 0 0 10px;">Missing required environment variable: <code>VITE_CONVEX_URL</code></p>
      <p style="margin: 0;">Set it in your Vercel Project Settings and redeploy.</p>
    </div>
  `;
  throw new Error('Missing VITE_CONVEX_URL');
}

const convex = new ConvexReactClient(convexUrl);

createRoot(rootEl).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>,
)

