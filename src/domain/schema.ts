import { z } from "zod";

export const GoalFrontmatterSchema = z
  .object({
    id: z.string().trim().min(1, "Frontmatter 'id' is required"),
    created_at: z.preprocess(
      (val) => {
        if (val instanceof Date && !Number.isNaN(val.getTime())) {
          return val.toISOString();
        }
        return val;
      },
      z
        .string()
        .trim()
        .min(1, "Frontmatter 'created_at' is required")
        .refine((val) => !Number.isNaN(Date.parse(val)), {
          message: "Frontmatter 'created_at' must be a valid ISO date string",
        })
    ),
    title: z.string().trim().min(1, "Frontmatter 'title' is required"),
  })
  .strict();

export type GoalFrontmatter = z.infer<typeof GoalFrontmatterSchema>;

export interface GoalNode {
  id: string;
  title: string;
  completed: boolean;
  children: GoalNode[];
}

export interface GoalDocument {
  filename: string;
  frontmatter: GoalFrontmatter;
  nodes: GoalNode[];
}
