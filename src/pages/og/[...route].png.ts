// Dynamic Open Graph card images, generated at build time.
//   /og/index.png, /og/projects.png, /og/cv.png, /og/post/<slug>.png
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { ogPng, type OgContent } from '../../lib/og';

type Entry = { route: string } & OgContent;

export const getStaticPaths: GetStaticPaths = async () => {
  const pages: Entry[] = [
    {
      route: 'index',
      kicker: 'Spacecraft GNC Engineer',
      title: 'Atilla Saadat',
      summary:
        'GNC Engineer II at Varda Space and M.S. Computer Science student at Georgia Tech. Spacecraft guidance, navigation, and control, ADCS, and machine learning.',
    },
    {
      route: 'projects',
      kicker: 'Mission Log',
      title: 'Projects, Research & Experience',
      summary:
        'Spacecraft GNC, ADCS, machine learning, and aerospace engineering projects, research, and awards.',
    },
    {
      route: 'cv',
      kicker: 'Curriculum Vitae',
      title: 'Atilla Saadat, CV',
      summary:
        'Spacecraft GNC Engineer II at Varda Space Industries. Experience, education, publications, and awards.',
    },
  ];

  const posts = await getCollection('posts');
  const postEntries: Entry[] = posts.map((post) => ({
    route: `post/${post.id}`,
    kicker: `Project Log · ${post.data.date.getUTCFullYear()}`,
    title: post.data.title,
    summary: post.data.description,
  }));

  return [...pages, ...postEntries].map((e) => ({ params: { route: e.route }, props: e }));
};

export const GET: APIRoute = async ({ props }) => {
  const { kicker, title, summary } = props as Entry;
  const png = await ogPng({ kicker, title, summary });
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
