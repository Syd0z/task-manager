import { GoalNode } from "./schema";

function computeRawNodeProgress(node: GoalNode): number {
  if (node.children.length === 0) {
    return node.completed ? 100 : 0;
  }

  const total = node.children.reduce(
    (sum, child) => sum + computeRawNodeProgress(child),
    0
  );
  return total / node.children.length;
}

/**
 * Dynamically calculates the progress percentage (0 - 100) of a single GoalNode bottom-up.
 * - Leaf node: 100 if `completed`, else 0.
 * - Parent node: average of its children's bottom-up progress percentages (rounded to nearest integer).
 */
export function calculateNodeProgress(node: GoalNode): number {
  return Math.round(computeRawNodeProgress(node));
}

/**
 * Dynamically calculates the overall progress percentage (0 - 100) of a GoalDocument's root nodes bottom-up.
 */
export function calculateTreeProgress(nodes: GoalNode[]): number {
  if (nodes.length === 0) {
    return 0;
  }
  const total = nodes.reduce(
    (sum, node) => sum + computeRawNodeProgress(node),
    0
  );
  return Math.round(total / nodes.length);
}
