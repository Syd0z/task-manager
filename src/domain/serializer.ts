import {
  GoalDocument,
  GoalFrontmatter,
  GoalFrontmatterSchema,
  GoalNode,
} from "./schema";

function formatYamlValue(value: string): string {
  if (/[:#[\]{}&*!|>'"%@`\n]/.test(value) || value.trim() !== value) {
    return JSON.stringify(value);
  }
  return value;
}

function serializeNodesRecursive(nodes: GoalNode[], depth: number = 0): string[] {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  for (const node of nodes) {
    const checkbox = node.completed ? "[x]" : "[ ]";
    lines.push(`${indent}- ${checkbox} ${node.title.trim()}`);
    if (node.children.length > 0) {
      lines.push(...serializeNodesRecursive(node.children, depth + 1));
    }
  }

  return lines;
}

/**
 * Pure inverse function of `parseGoalMarkdown`:
 * Serializes validated `GoalFrontmatter` and a nested `GoalNode[]` tree back into a valid `.md` string.
 * Progress percentage is never persisted to Markdown per SPEC.md.
 */
export function serializeGoalMarkdown(
  frontmatter: GoalFrontmatter,
  nodes: GoalNode[]
): string {
  const validated = GoalFrontmatterSchema.parse(frontmatter);

  const headerLines = [
    "---",
    `id: ${formatYamlValue(validated.id)}`,
    `created_at: ${formatYamlValue(validated.created_at)}`,
    `title: ${formatYamlValue(validated.title)}`,
    "---",
  ];

  const taskLines = serializeNodesRecursive(nodes, 0);
  if (taskLines.length === 0) {
    return `${headerLines.join("\n")}\n`;
  }

  return `${headerLines.join("\n")}\n\n${taskLines.join("\n")}\n`;
}

export function serializeGoalDocument(doc: GoalDocument): string {
  return serializeGoalMarkdown(doc.frontmatter, doc.nodes);
}
