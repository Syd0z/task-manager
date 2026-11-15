import matter from "gray-matter";
import {
  GoalDocument,
  GoalFrontmatter,
  GoalFrontmatterSchema,
  GoalNode,
} from "./schema";

// Ensure gray-matter's internal `Buffer.from(input)` works inside browser/WebView runtimes
if (typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>).Buffer === "undefined") {
  (globalThis as Record<string, unknown>).Buffer = {
    from: (input: string) => new TextEncoder().encode(input),
    isBuffer: () => false,
  };
}

export class MarkdownParseError extends Error {
  public readonly reason: "FRONTMATTER_INVALID" | "CONFLICT_DETECTED" | "SYNTAX_INVALID";

  constructor(
    message: string,
    reason: "FRONTMATTER_INVALID" | "CONFLICT_DETECTED" | "SYNTAX_INVALID" = "FRONTMATTER_INVALID"
  ) {
    super(message);
    this.name = "MarkdownParseError";
    this.reason = reason;
  }
}

const TASK_LINE_REGEX = /^([ \t]*)-\s*\[([ xX])\]\s*(.+)$/;
const GIT_CONFLICT_REGEX = /^(<{7}|={7}|>{7})(?:\s|$)/m;
const FRONTMATTER_BLOCK_REGEX = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

export interface ParsedMarkdownResult {
  frontmatter: GoalFrontmatter;
  nodes: GoalNode[];
}

/**
 * Pure function that parses a raw `.md` string:
 * 1. Rejects files with Git conflict markers or missing frontmatter delimiters.
 * 2. Extracts YAML frontmatter via `gray-matter` and strictly validates with Zod.
 * 3. Uses Regex to count indentation spaces and build a nested `GoalNode[]` tree.
 */
export function parseGoalMarkdown(rawMarkdown: string): ParsedMarkdownResult {
  if (GIT_CONFLICT_REGEX.test(rawMarkdown)) {
    throw new MarkdownParseError(
      "Git merge conflict markers detected in Markdown file",
      "CONFLICT_DETECTED"
    );
  }

  const normalizedInput = rawMarkdown.replace(/^\uFEFF/, "");
  if (!FRONTMATTER_BLOCK_REGEX.test(normalizedInput)) {
    throw new MarkdownParseError(
      "Missing or unclosed YAML frontmatter block",
      "FRONTMATTER_INVALID"
    );
  }

  let parsedMatter: matter.GrayMatterFile<string>;
  try {
    parsedMatter = matter(normalizedInput);
  } catch (err) {
    throw new MarkdownParseError(
      `YAML frontmatter syntax error: ${err instanceof Error ? err.message : String(err)}`,
      "FRONTMATTER_INVALID"
    );
  }

  const validation = GoalFrontmatterSchema.safeParse(parsedMatter.data);
  if (!validation.success) {
    const issueSummary = validation.error.issues
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    throw new MarkdownParseError(
      `Invalid frontmatter schema: ${issueSummary}`,
      "FRONTMATTER_INVALID"
    );
  }

  const frontmatter = validation.data;
  const lines = parsedMatter.content.split(/\r?\n/);

  const rootNodes: GoalNode[] = [];
  const stack: Array<{ indent: number; node: GoalNode }> = [];
  let nodeCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.trim().length === 0) {
      continue;
    }

    const match = TASK_LINE_REGEX.exec(rawLine);
    if (!match) {
      throw new MarkdownParseError(
        `Invalid task syntax at line ${i + 1}: "${rawLine.trim()}"`,
        "SYNTAX_INVALID"
      );
    }

    const [, rawIndent, checkChar, rawTitle] = match;
    const indent = rawIndent.replace(/\t/g, "  ").length;
    const completed = checkChar.toLowerCase() === "x";
    const title = rawTitle.trim();

    nodeCounter += 1;
    const newNode: GoalNode = {
      id: `${frontmatter.id}-node-${nodeCounter}`,
      title,
      completed,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(newNode);
    } else {
      stack[stack.length - 1].node.children.push(newNode);
    }

    stack.push({ indent, node: newNode });
  }

  return {
    frontmatter,
    nodes: rootNodes,
  };
}

export function parseGoalDocument(
  filename: string,
  rawMarkdown: string
): GoalDocument {
  const { frontmatter, nodes } = parseGoalMarkdown(rawMarkdown);
  return {
    filename,
    frontmatter,
    nodes,
  };
}
