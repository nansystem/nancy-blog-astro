// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import rehypeMermaid from 'rehype-mermaid';

// https://astro.build/config
export default defineConfig({
	site: 'https://nansystem.com',
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => !page.includes('/category/'),
		}),
	],
	markdown: {
		syntaxHighlight: {
			type: 'shiki',
			excludeLangs: ['mermaid'],
		},
		rehypePlugins: [rehypeMermaid],
	},
});
