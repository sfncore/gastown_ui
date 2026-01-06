import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/tests/setup.ts'],
		alias: {
			$lib: '/src/lib',
			// Force Svelte to use browser build in tests
			svelte: 'svelte'
		},
		// Use the svelte plugin for tests to properly compile components
		deps: {
			optimizer: {
				web: {
					include: ['svelte']
				}
			}
		}
	},
	resolve: {
		conditions: ['browser']
	}
});
