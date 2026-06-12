import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),
    highlight: z.string().optional(), // award/recognition callout shown on cards
    highlightHref: z.string().url().optional(), // link the highlight points to
  }),
});

export const collections = { posts };
