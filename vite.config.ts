import { defineConfig } from 'vite';

// GitHub Pages publishes this project at https://<owner>.github.io/kotoba-journey/
// so the production base path must match the repository name.
export default defineConfig({
  base: '/kotoba-journey/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
