// Vite configuration wiring in the SvelteKit plugin and dev-server port.
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: parseInt(process.env.PORT || '5174'),
		strictPort: false
	}
});
