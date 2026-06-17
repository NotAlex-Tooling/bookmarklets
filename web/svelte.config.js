// SvelteKit configuration: Vercel adapter pinned to Node 22, runes enabled outside node_modules.
import adapter from '@sveltejs/adapter-vercel';

const config = {
	kit: {
		adapter: adapter({ runtime: 'nodejs22.x' })
	},
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.includes('node_modules') ? undefined : { runes: true }
	}
};

export default config;
