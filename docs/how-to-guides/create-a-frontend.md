# 1. Init

- Make a folder: `apps/{UI NAME}`
- CD into it -- all the following commands and files will be using that folder as a base
- run `npm init -y`

# 2. Config
## package.json
```json
{
  "name": "ui", // <- change this to your UI name
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 5173"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^5.1.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.0"
  }
}
```

## tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "vite.config.ts", "index.html"],
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "types": ["vite/client"]
  }
}
```

## vite.config.ts
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If you prefer no plugin, you can omit react() and rely on default.
// The plugin adds fast refresh and sensible defaults.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  clearScreen: false, // this is so that when we run it using concurrently we don't clear the terminal
});
```

# 3. Install
```bash
npm install
npm i -D @vitejs/plugin-react
```

# 4. Basic react app
## index.html
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vet Booking — UI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## src/main.tsx
```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

## src/App.tsx
```typescript
export default function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Vet Booking — UI</h1>
      <p>React + TypeScript + Vite is alive.</p>
    </div>
  );
}
```

# 5. Verify
```bash
npm run dev
```

# 6. Extra
If in a mono repo situation, you might add the new UI to your npm run dev concurrently script.