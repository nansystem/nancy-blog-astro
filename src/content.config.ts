import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string().nullable().default(''),
		date: z.coerce.date(),
		categories: z.array(z.string()).default([]),
		permalink: z.string(),
		published: z.boolean().default(true),
	}),
});

export const collections = { blog };
