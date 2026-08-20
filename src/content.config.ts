import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const weeks = defineCollection({
  // Load Markdown and MDX files in the `src/content/weeks/` directory.
  loader: glob({ base: "./src/content/weeks", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(), // Optional description that can include markdown
      longDescription: z.string().optional(), // Optional long description with markdown support
      lecture: z.string().optional(), // Optional lecture content in markdown format
      // Optional flag to indicate this markdown file should NOT be generated as a standalone page.
      // If set to `false` the content can still be rendered in listings or embedded views.
      page: z.boolean().optional(),
      draft: z.boolean().optional(),
      week: z.number(), // Week number for ordering
      heroImage: image().optional(),
    }),
});

const tutorials = defineCollection({
  // Load Markdown and MDX files in the `src/content/tutorials/` directory.
  loader: glob({ base: "./src/content/tutorials", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(), // Optional description
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(), // Difficulty level
      duration: z.string().optional(), // Estimated duration (e.g., "30 minutes")
      tags: z.array(z.string()).optional(), // Tags for categorization
      publishDate: z.date().optional(), // Publication date
      heroImage: image().optional(),
      order: z.number().optional(), // Optional ordering for tutorials
      draft: z.boolean().optional(),
    }),
});

export const collections = { weeks, tutorials };
