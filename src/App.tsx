import {
  Brain,
  CheckCircle2,
  CirclePlus,
  Code2,
  GitBranch,
  ListTree,
  Network,
  RotateCcw,
  Shuffle,
  Sigma,
  SplitSquareHorizontal,
  Trash2,
  XCircle,
} from "lucide-react";
import type { DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type Topic = "api" | "backtracking" | "sets" | "insert" | "delete" | "rb-insert" | "rb-delete" | "skip" | "analysis" | "exam" | "mixed";
type ProblemKind =
  | "api-runtime"
  | "api-code"
  | "backtracking-code"
  | "backtracking-concept"
  | "ds-array"
  | "ds-code"
  | "tree-insert"
  | "tree-delete"
  | "rb-insert"
  | "rb-delete"
  | "skip-concept"
  | "skip-structure"
  | "analysis-math";
type Scenario =
  | "Basic"
  | "Worksheet"
  | "Runtime"
  | "Code"
  | "Concept"
  | "Trace"
  | "Math"
  | "Mock"
  | "Overflow"
  | "Cascade"
  | "Borrow"
  | "Merge"
  | "Root"
  | "Recolor"
  | "SingleRotate"
  | "DoubleRotate"
  | "BlackLeaf"
  | "SiblingRed";

type TraceEvent = {
  title: string;
  detail: string;
};

type TreeNode = {
  id: string;
  keys: number[];
  children: TreeNode[];
};

type RBColor = "red" | "black";

type RBNode = {
  id: string;
  key: number;
  color: RBColor;
  left: RBNode | null;
  right: RBNode | null;
};

type DragPayload =
  | { type: "palette-key"; key: number }
  | { type: "tree-key"; fromId: string; fromIndex: number }
  | { type: "new-child" }
  | { type: "tree-node"; nodeId: string }
  | { type: "rb-palette-node"; key: number; color: RBColor }
  | { type: "rb-node"; nodeId: string }
  | { type: "rb-loose-node"; looseId: string };

type LayoutNode = {
  node: TreeNode;
  x: number;
  y: number;
  width: number;
};

type LayoutLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type TreeLayout = {
  nodes: LayoutNode[];
  lines: LayoutLine[];
  width: number;
  height: number;
};

type RBLayoutNode = {
  node: RBNode;
  x: number;
  y: number;
  width: number;
};

type RBTreeLayout = {
  nodes: RBLayoutNode[];
  lines: LayoutLine[];
  width: number;
  height: number;
};

type QuizPart = {
  id: string;
  label: string;
  prompt: string;
  answer: string;
  options?: string[];
};

type Problem = {
  id: string;
  kind: ProblemKind;
  title: string;
  prompt: string;
  scenario: Scenario;
  trace: TraceEvent[];
  answerType: "array" | "tree" | "rb" | "quiz";
  points?: number;
  expectedArray?: number[];
  initialArray?: number[];
  indexes?: number[];
  initialTree?: TreeNode;
  expectedTree?: TreeNode;
  initialRBTree?: RBNode;
  expectedRBTree?: RBNode;
  quizParts?: QuizPart[];
  visual?: {
    type: "skip-list" | "grid" | "runtime-table";
    levels?: number[][];
    grid?: string[][];
  };
};

type Stats = {
  attempted: number;
  correct: number;
  streak: number;
  bestStreak: number;
};

const TOPICS: { id: Topic; label: string; icon: typeof Network }[] = [
  { id: "api", label: "Java API", icon: Code2 },
  { id: "backtracking", label: "Backtracking", icon: Brain },
  { id: "sets", label: "Disjoint Sets", icon: Network },
  { id: "insert", label: "2-4 Insert", icon: SplitSquareHorizontal },
  { id: "delete", label: "2-4 Delete", icon: Trash2 },
  { id: "rb-insert", label: "RB Insert", icon: GitBranch },
  { id: "rb-delete", label: "RB Delete", icon: GitBranch },
  { id: "skip", label: "Skip Lists", icon: ListTree },
  { id: "analysis", label: "Analysis", icon: Sigma },
  { id: "exam", label: "Exam Mode", icon: Shuffle },
  { id: "mixed", label: "Mixed Review", icon: Shuffle },
];

const SCENARIOS: Record<Topic, Scenario[]> = {
  api: ["Runtime", "Code"],
  backtracking: ["Code", "Concept"],
  sets: ["Basic", "Worksheet", "Cascade"],
  insert: ["Basic", "Overflow", "Cascade"],
  delete: ["Basic", "Borrow", "Merge", "Root"],
  "rb-insert": ["Basic", "Recolor", "SingleRotate", "DoubleRotate", "Root"],
  "rb-delete": ["Basic", "BlackLeaf", "SiblingRed", "Borrow", "DoubleRotate", "Cascade"],
  skip: ["Concept", "Trace", "Math"],
  analysis: ["Runtime", "Math", "Concept"],
  exam: ["Mock"],
  mixed: ["Worksheet", "Overflow", "Merge", "Cascade"],
};

const SCENARIO_LABELS: Record<Scenario, string> = {
  Basic: "Basic",
  Worksheet: "Worksheet",
  Runtime: "Runtime",
  Code: "Code",
  Concept: "Concept",
  Trace: "Trace",
  Math: "Math",
  Mock: "Mock Exam",
  Overflow: "Overflow",
  Cascade: "Cascade",
  Borrow: "Borrow",
  Merge: "Merge",
  Root: "Root",
  Recolor: "Recolor",
  SingleRotate: "Single Rotate",
  DoubleRotate: "Double Rotate",
  BlackLeaf: "Black Leaf",
  SiblingRed: "Sibling Red",
};

const emptyStats: Stats = {
  attempted: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
};

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]) {
  return items[Math.floor(rng() * items.length)];
}

function range(n: number, start = 0) {
  return Array.from({ length: n }, (_, i) => i + start);
}

function nextNodeId() {
  return crypto.randomUUID();
}

function cloneTree(node: TreeNode): TreeNode {
  return {
    id: node.id,
    keys: [...node.keys],
    children: node.children.map(cloneTree),
  };
}

function normalizeTree(node: TreeNode | null): string {
  if (!node) return "";
  return JSON.stringify({
    keys: [...node.keys].sort((a, b) => a - b),
    children: node.children.map(normalizeTree),
  });
}

function cloneRBTree(node: RBNode | null): RBNode | null {
  if (!node) return null;
  return {
    id: node.id,
    key: node.key,
    color: node.color,
    left: cloneRBTree(node.left),
    right: cloneRBTree(node.right),
  };
}

function normalizeRBTree(node: RBNode | null): string {
  if (!node) return "";
  return JSON.stringify({
    key: node.key,
    color: node.color,
    left: normalizeRBTree(node.left),
    right: normalizeRBTree(node.right),
  });
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function quizMatches(answer: string, expected: string) {
  const actual = normalizeText(answer);
  const wanted = normalizeText(expected);
  if (actual === wanted) return true;
  return wanted.split("|").some((option) => actual === normalizeText(option));
}

const TREE_NODE_HEIGHT = 48;
const TREE_LEVEL_GAP = 88;
const TREE_SIBLING_GAP = 34;
const TREE_PADDING = 26;
const RB_NODE_SIZE = 54;

function getNodeWidth(node: TreeNode) {
  return Math.max(72, node.keys.length * 42 + 28);
}

function buildTreeLayout(root: TreeNode): TreeLayout {
  const nodes: LayoutNode[] = [];
  const lines: LayoutLine[] = [];

  type MeasuredTree = {
    node: TreeNode;
    width: number;
    nodeWidth: number;
    children: MeasuredTree[];
  };

  const measure = (node: TreeNode): MeasuredTree => {
    const nodeWidth = getNodeWidth(node);
    const childLayouts = node.children.map(measure);
    const childrenWidth =
      childLayouts.length === 0
        ? 0
        : childLayouts.reduce((total, child) => total + child.width, 0) + TREE_SIBLING_GAP * (childLayouts.length - 1);
    const width = Math.max(nodeWidth, childrenWidth);
    return { node, width, nodeWidth, children: childLayouts };
  };

  const place = (measured: MeasuredTree, left: number, depth: number): number => {
    const centerX = left + measured.width / 2;
    const y = depth * (TREE_NODE_HEIGHT + TREE_LEVEL_GAP);
    nodes.push({ node: measured.node, x: TREE_PADDING + centerX, y: TREE_PADDING + y, width: measured.nodeWidth });

    const childrenWidth =
      measured.children.length === 0
        ? 0
        : measured.children.reduce((total, child) => total + child.width, 0) + TREE_SIBLING_GAP * (measured.children.length - 1);
    let childLeft = left + (measured.width - childrenWidth) / 2;
    measured.children.forEach((childLayout) => {
      const childX = place(childLayout, childLeft, depth + 1);
      const childY = (depth + 1) * (TREE_NODE_HEIGHT + TREE_LEVEL_GAP);
      lines.push({
        x1: TREE_PADDING + centerX,
        y1: TREE_PADDING + y + TREE_NODE_HEIGHT,
        x2: TREE_PADDING + childX,
        y2: TREE_PADDING + childY,
      });
      childLeft += childLayout.width + TREE_SIBLING_GAP;
    });

    return centerX;
  };

  const measured = measure(root);
  place(measured, 0, 0);
  const maxDepth = Math.max(0, ...nodes.map((layoutNode) => Math.round((layoutNode.y - TREE_PADDING) / (TREE_NODE_HEIGHT + TREE_LEVEL_GAP))));

  return {
    nodes,
    lines,
    width: measured.width + TREE_PADDING * 2,
    height: maxDepth * (TREE_NODE_HEIGHT + TREE_LEVEL_GAP) + TREE_NODE_HEIGHT + TREE_PADDING * 2,
  };
}

function buildRBTreeLayout(root: RBNode): RBTreeLayout {
  const nodes: RBLayoutNode[] = [];
  const lines: LayoutLine[] = [];

  type MeasuredRBTree = {
    node: RBNode;
    width: number;
    children: (MeasuredRBTree | null)[];
  };

  const measure = (node: RBNode): MeasuredRBTree => {
    const childLayouts = [node.left ? measure(node.left) : null, node.right ? measure(node.right) : null];
    const visibleChildren = childLayouts.filter((child): child is MeasuredRBTree => child !== null);
    const childrenWidth =
      visibleChildren.length === 0
        ? 0
        : childLayouts.reduce((total, child) => total + (child?.width ?? RB_NODE_SIZE), 0) + TREE_SIBLING_GAP;
    return { node, width: Math.max(RB_NODE_SIZE, childrenWidth), children: childLayouts };
  };

  const place = (measured: MeasuredRBTree, left: number, depth: number): number => {
    const centerX = left + measured.width / 2;
    const y = depth * (TREE_NODE_HEIGHT + TREE_LEVEL_GAP);
    nodes.push({ node: measured.node, x: TREE_PADDING + centerX, y: TREE_PADDING + y, width: RB_NODE_SIZE });

    const childrenWidth =
      measured.children.every((child) => child === null)
        ? 0
        : measured.children.reduce((total, child) => total + (child?.width ?? RB_NODE_SIZE), 0) + TREE_SIBLING_GAP;
    let childLeft = left + (measured.width - childrenWidth) / 2;
    measured.children.forEach((childLayout) => {
      const slotWidth = childLayout?.width ?? RB_NODE_SIZE;
      if (childLayout) {
        const childX = place(childLayout, childLeft, depth + 1);
        const childY = (depth + 1) * (TREE_NODE_HEIGHT + TREE_LEVEL_GAP);
        lines.push({
          x1: TREE_PADDING + centerX,
          y1: TREE_PADDING + y + RB_NODE_SIZE,
          x2: TREE_PADDING + childX,
          y2: TREE_PADDING + childY,
        });
      }
      childLeft += slotWidth + TREE_SIBLING_GAP;
    });

    return centerX;
  };

  const measured = measure(root);
  place(measured, 0, 0);
  const maxDepth = Math.max(0, ...nodes.map((layoutNode) => Math.round((layoutNode.y - TREE_PADDING) / (TREE_NODE_HEIGHT + TREE_LEVEL_GAP))));

  return {
    nodes,
    lines,
    width: measured.width + TREE_PADDING * 2,
    height: maxDepth * (TREE_NODE_HEIGHT + TREE_LEVEL_GAP) + RB_NODE_SIZE + TREE_PADDING * 2,
  };
}

class DisjointSet {
  parent: number[];
  height: number[];
  trace: TraceEvent[] = [];

  constructor(n: number, startAtOne = false) {
    const size = startAtOne ? n + 1 : n;
    this.parent = range(size);
    this.height = Array(size).fill(0);
  }

  find(x: number, compress: boolean): number {
    if (this.parent[x] === x) return x;
    const root = this.find(this.parent[x], compress);
    if (compress && this.parent[x] !== root) {
      this.trace.push({
        title: `Compress ${x}`,
        detail: `Parent of ${x} changes from ${this.parent[x]} to ${root}.`,
      });
      this.parent[x] = root;
    }
    return root;
  }

  union(a: number, b: number) {
    const rootA = this.find(a, false);
    const rootB = this.find(b, false);
    if (rootA === rootB) {
      this.trace.push({
        title: `union(${a}, ${b})`,
        detail: `${a} and ${b} already have root ${rootA}; array stays the same.`,
      });
      return;
    }

    let parentRoot = rootA;
    let childRoot = rootB;
    if (this.height[rootB] > this.height[rootA]) {
      parentRoot = rootB;
      childRoot = rootA;
    } else if (this.height[rootA] === this.height[rootB]) {
      parentRoot = Math.min(rootA, rootB);
      childRoot = Math.max(rootA, rootB);
      this.height[parentRoot]++;
    }

    this.parent[childRoot] = parentRoot;
    this.trace.push({
      title: `union(${a}, ${b})`,
      detail: `Attach root ${childRoot} under root ${parentRoot}.`,
    });
  }
}

class TwoFourTree {
  root: TreeNode | null = null;
  trace: TraceEvent[] = [];

  insert(value: number) {
    if (!this.root) {
      this.root = { id: nextNodeId(), keys: [value], children: [] };
      this.trace.push({ title: `Insert ${value}`, detail: "Create the root." });
      return;
    }

    this.insertInto(this.root, value);
    this.fixOverflowPath();
  }

  delete(value: number) {
    if (!this.root) return;
    this.deleteFrom(this.root, value);
    if (this.root.keys.length === 0 && this.root.children.length > 0) {
      this.root = this.root.children[0];
      this.trace.push({ title: "Root shrink", detail: "Empty root is replaced by its only child." });
    }
    if (this.root.keys.length === 0 && this.root.children.length === 0) {
      this.root = null;
    }
  }

  private insertInto(node: TreeNode, value: number) {
    if (node.children.length === 0) {
      node.keys.push(value);
      node.keys.sort((a, b) => a - b);
      this.trace.push({ title: `Place ${value}`, detail: `Insert into leaf [${node.keys.join(", ")}].` });
      return;
    }

    const childIndex = node.keys.findIndex((key) => value < key);
    const index = childIndex === -1 ? node.children.length - 1 : childIndex;
    this.insertInto(node.children[index], value);
  }

  private fixOverflowPath() {
    if (!this.root) return;
    const splitChild = (node: TreeNode, index: number) => {
      const child = node.children[index];
      if (child.keys.length <= 3) return;
      const promoted = child.keys[2];
      const left: TreeNode = {
        id: nextNodeId(),
        keys: child.keys.slice(0, 2),
        children: child.children.slice(0, 3),
      };
      const right: TreeNode = {
        id: nextNodeId(),
        keys: child.keys.slice(3),
        children: child.children.slice(3),
      };
      node.keys.splice(index, 0, promoted);
      node.children.splice(index, 1, left, right);
      this.trace.push({
        title: `Split [${child.keys.join(", ")}]`,
        detail: `Send up ${promoted}, following the worksheet rule to send up the third value.`,
      });
    };

    let changed = true;
    while (changed && this.root) {
      changed = false;
      const walk = (node: TreeNode) => {
        for (const child of node.children) walk(child);
        for (let i = 0; i < node.children.length; i++) {
          if (node.children[i].keys.length > 3) {
            splitChild(node, i);
            changed = true;
          }
        }
      };
      walk(this.root);
      if (this.root.keys.length > 3) {
        const old: TreeNode = this.root;
        const promoted: number = old.keys[2];
        this.root = {
          id: nextNodeId(),
          keys: [promoted],
          children: [
            { id: nextNodeId(), keys: old.keys.slice(0, 2), children: old.children.slice(0, 3) },
            { id: nextNodeId(), keys: old.keys.slice(3), children: old.children.slice(3) },
          ],
        };
        this.trace.push({
          title: "Split root",
          detail: `Root overflow sends up ${promoted}, increasing tree height.`,
        });
        changed = true;
      }
    }
  }

  private deleteFrom(node: TreeNode, value: number) {
    const keyIndex = node.keys.indexOf(value);
    if (keyIndex !== -1 && node.children.length === 0) {
      node.keys.splice(keyIndex, 1);
      this.trace.push({ title: `Delete ${value}`, detail: "Remove it directly from the leaf." });
      return;
    }

    if (keyIndex !== -1) {
      const successor = this.minValue(node.children[keyIndex + 1]);
      node.keys[keyIndex] = successor;
      this.trace.push({
        title: `Replace ${value}`,
        detail: `Use successor ${successor}, then remove ${successor} from the child subtree.`,
      });
      this.deleteFrom(node.children[keyIndex + 1], successor);
      this.repairChild(node, keyIndex + 1);
      return;
    }

    if (node.children.length === 0) return;
    const childIndex = node.keys.findIndex((key) => value < key);
    const index = childIndex === -1 ? node.children.length - 1 : childIndex;
    this.deleteFrom(node.children[index], value);
    this.repairChild(node, index);
  }

  private minValue(node: TreeNode): number {
    let cur = node;
    while (cur.children.length > 0) cur = cur.children[0];
    return cur.keys[0];
  }

  private repairChild(parent: TreeNode, index: number) {
    const child = parent.children[index];
    if (!child || child.keys.length > 0) return;

    const left = parent.children[index - 1];
    const right = parent.children[index + 1];

    if (left && left.keys.length > 1) {
      child.keys.unshift(parent.keys[index - 1]);
      parent.keys[index - 1] = left.keys.pop()!;
      if (left.children.length > 0) child.children.unshift(left.children.pop()!);
      this.trace.push({ title: "Borrow left", detail: "Rotate one key through the parent." });
      return;
    }

    if (right && right.keys.length > 1) {
      child.keys.push(parent.keys[index]);
      parent.keys[index] = right.keys.shift()!;
      if (right.children.length > 0) child.children.push(right.children.shift()!);
      this.trace.push({ title: "Borrow right", detail: "Rotate one key through the parent." });
      return;
    }

    if (left) {
      left.keys.push(parent.keys.splice(index - 1, 1)[0], ...child.keys);
      left.children.push(...child.children);
      parent.children.splice(index, 1);
      this.trace.push({ title: "Merge left", detail: "Fuse the empty child with its left sibling." });
    } else if (right) {
      child.keys.push(parent.keys.splice(index, 1)[0], ...right.keys);
      child.children.push(...right.children);
      parent.children.splice(index + 1, 1);
      this.trace.push({ title: "Merge right", detail: "Fuse the empty child with its right sibling." });
    }
  }
}

type RBInternal = {
  id: string;
  key: number;
  color: RBColor;
  left: RBInternal | null;
  right: RBInternal | null;
  parent: RBInternal | null;
};

class RedBlackTree {
  root: RBInternal | null = null;
  trace: TraceEvent[] = [];

  insert(value: number) {
    const node: RBInternal = { id: nextNodeId(), key: value, color: "red", left: null, right: null, parent: null };
    let parent: RBInternal | null = null;
    let cur = this.root;
    while (cur) {
      parent = cur;
      cur = value < cur.key ? cur.left : cur.right;
    }
    node.parent = parent;
    if (!parent) {
      this.root = node;
    } else if (value < parent.key) {
      parent.left = node;
    } else {
      parent.right = node;
    }

    this.trace.push({
      title: `Insert ${value}`,
      detail: parent ? `Place ${value} as a red child of ${parent.key}.` : `Create ${value} as the root.`,
    });
    this.fixInsert(node);
  }

  delete(value: number) {
    const target = this.find(value);
    if (!target) return;

    let y = target;
    let yOriginalColor = y.color;
    let x: RBInternal | null = null;
    let xParent: RBInternal | null = null;

    if (!target.left) {
      x = target.right;
      xParent = target.parent;
      this.transplant(target, target.right);
    } else if (!target.right) {
      x = target.left;
      xParent = target.parent;
      this.transplant(target, target.left);
    } else {
      y = this.minimum(target.right);
      yOriginalColor = y.color;
      x = y.right;
      if (y.parent === target) {
        xParent = y;
        if (x) x.parent = y;
      } else {
        xParent = y.parent;
        this.transplant(y, y.right);
        y.right = target.right;
        y.right.parent = y;
      }
      this.transplant(target, y);
      y.left = target.left;
      y.left.parent = y;
      y.color = target.color;
      this.trace.push({
        title: `Replace ${value}`,
        detail: `Swap in successor ${y.key}, then remove the successor from its old spot.`,
      });
    }

    this.trace.push({
      title: `Delete ${value}`,
      detail: yOriginalColor === "red" ? "A red removal does not change black height." : "A black removal creates a black-height problem to repair.",
    });
    if (yOriginalColor === "black") this.fixDelete(x, xParent);
    if (this.root) this.root.color = "black";
  }

  toNode(): RBNode | null {
    const convert = (node: RBInternal | null): RBNode | null =>
      node
        ? {
            id: node.id,
            key: node.key,
            color: node.color,
            left: convert(node.left),
            right: convert(node.right),
          }
        : null;
    return convert(this.root);
  }

  private fixInsert(node: RBInternal) {
    let cur = node;
    while (cur.parent?.color === "red") {
      const parent = cur.parent;
      const grand = parent.parent;
      if (!grand) break;
      if (parent === grand.left) {
        const uncle = grand.right;
        if (this.colorOf(uncle) === "red") {
          parent.color = "black";
          uncle!.color = "black";
          grand.color = "red";
          this.trace.push({
            title: "Recolor",
            detail: `Parent ${parent.key} and uncle ${uncle!.key} become black; grandparent ${grand.key} becomes red.`,
          });
          cur = grand;
        } else {
          if (cur === parent.right) {
            cur = parent;
            this.rotateLeft(cur);
            this.trace.push({ title: "Double Rotate", detail: `Left rotate ${cur.key} to turn the inside case into an outside case.` });
          }
          cur.parent!.color = "black";
          grand.color = "red";
          this.rotateRight(grand);
          this.trace.push({ title: "Single Rotate", detail: `Right rotate ${grand.key}; the new subtree root becomes black.` });
        }
      } else {
        const uncle = grand.left;
        if (this.colorOf(uncle) === "red") {
          parent.color = "black";
          uncle!.color = "black";
          grand.color = "red";
          this.trace.push({
            title: "Recolor",
            detail: `Parent ${parent.key} and uncle ${uncle!.key} become black; grandparent ${grand.key} becomes red.`,
          });
          cur = grand;
        } else {
          if (cur === parent.left) {
            cur = parent;
            this.rotateRight(cur);
            this.trace.push({ title: "Double Rotate", detail: `Right rotate ${cur.key} to turn the inside case into an outside case.` });
          }
          cur.parent!.color = "black";
          grand.color = "red";
          this.rotateLeft(grand);
          this.trace.push({ title: "Single Rotate", detail: `Left rotate ${grand.key}; the new subtree root becomes black.` });
        }
      }
    }
    if (this.root && this.root.color !== "black") {
      this.root.color = "black";
      this.trace.push({ title: "Root black", detail: "The root is always recolored black at the end." });
    }
  }

  private fixDelete(node: RBInternal | null, parent: RBInternal | null) {
    let cur = node;
    let curParent = parent;
    while (cur !== this.root && this.colorOf(cur) === "black" && curParent) {
      if (cur === curParent.left) {
        let sibling = curParent.right;
        if (this.colorOf(sibling) === "red") {
          sibling!.color = "black";
          curParent.color = "red";
          this.rotateLeft(curParent);
          this.trace.push({ title: "Sibling Red", detail: `Sibling ${sibling!.key} is red, so rotate left at ${curParent.key} first.` });
          sibling = curParent.right;
        }
        if (this.colorOf(sibling?.left ?? null) === "black" && this.colorOf(sibling?.right ?? null) === "black") {
          if (sibling) sibling.color = "red";
          this.trace.push({ title: "Cascade", detail: `Sibling ${sibling?.key ?? "nil"} has no red child; recolor and move the deficit upward.` });
          cur = curParent;
          curParent = cur.parent;
        } else {
          if (this.colorOf(sibling?.right ?? null) === "black") {
            if (sibling?.left) sibling.left.color = "black";
            if (sibling) {
              sibling.color = "red";
              this.rotateRight(sibling);
            }
            this.trace.push({ title: "Double Rotate", detail: "Rotate the sibling first so the outside child is red." });
            sibling = curParent.right;
          }
          if (sibling) sibling.color = curParent.color;
          curParent.color = "black";
          if (sibling?.right) sibling.right.color = "black";
          this.rotateLeft(curParent);
          this.trace.push({ title: "Borrow", detail: "Rotate through the parent and recolor to restore black height." });
          cur = this.root;
        }
      } else {
        let sibling = curParent.left;
        if (this.colorOf(sibling) === "red") {
          sibling!.color = "black";
          curParent.color = "red";
          this.rotateRight(curParent);
          this.trace.push({ title: "Sibling Red", detail: `Sibling ${sibling!.key} is red, so rotate right at ${curParent.key} first.` });
          sibling = curParent.left;
        }
        if (this.colorOf(sibling?.right ?? null) === "black" && this.colorOf(sibling?.left ?? null) === "black") {
          if (sibling) sibling.color = "red";
          this.trace.push({ title: "Cascade", detail: `Sibling ${sibling?.key ?? "nil"} has no red child; recolor and move the deficit upward.` });
          cur = curParent;
          curParent = cur.parent;
        } else {
          if (this.colorOf(sibling?.left ?? null) === "black") {
            if (sibling?.right) sibling.right.color = "black";
            if (sibling) {
              sibling.color = "red";
              this.rotateLeft(sibling);
            }
            this.trace.push({ title: "Double Rotate", detail: "Rotate the sibling first so the outside child is red." });
            sibling = curParent.left;
          }
          if (sibling) sibling.color = curParent.color;
          curParent.color = "black";
          if (sibling?.left) sibling.left.color = "black";
          this.rotateRight(curParent);
          this.trace.push({ title: "Borrow", detail: "Rotate through the parent and recolor to restore black height." });
          cur = this.root;
        }
      }
    }
    if (cur) cur.color = "black";
  }

  private rotateLeft(node: RBInternal) {
    const pivot = node.right;
    if (!pivot) return;
    node.right = pivot.left;
    if (pivot.left) pivot.left.parent = node;
    pivot.parent = node.parent;
    if (!node.parent) {
      this.root = pivot;
    } else if (node === node.parent.left) {
      node.parent.left = pivot;
    } else {
      node.parent.right = pivot;
    }
    pivot.left = node;
    node.parent = pivot;
  }

  private rotateRight(node: RBInternal) {
    const pivot = node.left;
    if (!pivot) return;
    node.left = pivot.right;
    if (pivot.right) pivot.right.parent = node;
    pivot.parent = node.parent;
    if (!node.parent) {
      this.root = pivot;
    } else if (node === node.parent.right) {
      node.parent.right = pivot;
    } else {
      node.parent.left = pivot;
    }
    pivot.right = node;
    node.parent = pivot;
  }

  private transplant(oldNode: RBInternal, newNode: RBInternal | null) {
    if (!oldNode.parent) {
      this.root = newNode;
    } else if (oldNode === oldNode.parent.left) {
      oldNode.parent.left = newNode;
    } else {
      oldNode.parent.right = newNode;
    }
    if (newNode) newNode.parent = oldNode.parent;
  }

  private find(value: number) {
    let cur = this.root;
    while (cur && cur.key !== value) cur = value < cur.key ? cur.left : cur.right;
    return cur;
  }

  private minimum(node: RBInternal) {
    let cur = node;
    while (cur.left) cur = cur.left;
    return cur;
  }

  private colorOf(node: RBInternal | null) {
    return node?.color ?? "black";
  }
}

function generateProblem(topic: Topic, seed: number, scenario: Scenario): Problem {
  const rng = makeRng(seed);
  const kind =
    topic === "api"
      ? scenario === "Code" ? "api-code" : "api-runtime"
      : topic === "backtracking"
        ? scenario === "Concept" ? "backtracking-concept" : "backtracking-code"
        : topic === "sets"
      ? "ds-array"
      : topic === "insert"
        ? "tree-insert"
        : topic === "delete"
          ? "tree-delete"
          : topic === "rb-insert"
            ? "rb-insert"
            : topic === "rb-delete"
              ? "rb-delete"
              : topic === "skip"
                ? scenario === "Trace" ? "skip-structure" : "skip-concept"
                : topic === "analysis"
                  ? "analysis-math"
                  : topic === "exam"
                    ? pick(rng, ["api-runtime", "api-code", "backtracking-code", "ds-code", "tree-delete", "rb-delete", "skip-structure", "analysis-math"] as ProblemKind[])
                    : pick(rng, ["ds-array", "tree-insert", "tree-delete", "rb-insert", "skip-concept", "analysis-math"] as ProblemKind[]);

  if (kind === "api-runtime") return generateApiRuntime(rng, seed, scenario);
  if (kind === "api-code") return generateRollingMedian(rng, seed, scenario);
  if (kind === "backtracking-code") return generateBacktrackingCode(rng, seed, scenario);
  if (kind === "backtracking-concept") return generateBacktrackingConcept(rng, seed, scenario);
  if (kind === "ds-array") return generateDsArray(rng, seed, scenario);
  if (kind === "ds-code") return generateDsCode(rng, seed, scenario);
  if (kind === "tree-delete") return generateTreeDelete(rng, seed, scenario);
  if (kind === "rb-insert") return generateRBInsert(rng, seed, scenario);
  if (kind === "rb-delete") return generateRBDelete(rng, seed, scenario);
  if (kind === "skip-concept") return generateSkipConcept(rng, seed, scenario);
  if (kind === "skip-structure") return generateSkipStructure(rng, seed, scenario);
  if (kind === "analysis-math") return generateAnalysis(rng, seed, scenario);
  return generateTreeInsert(rng, seed, scenario);
}

function quizProblem(params: Omit<Problem, "answerType" | "trace"> & { trace?: TraceEvent[] }): Problem {
  return {
    ...params,
    trace: params.trace ?? params.quizParts?.map((part) => ({ title: part.label, detail: `Expected: ${part.answer.replaceAll("|", " or ")}` })) ?? [],
    answerType: "quiz",
  };
}

function generateApiRuntime(rng: () => number, seed: number, scenario: Scenario): Problem {
  const operations = shuffle(rng, [
    ["Collections.sort(List<T> list)", "O(n log n)"],
    ["ArrayList.add(E e)", "O(1)"],
    ["ArrayList.add(int index, E element)", "O(n)"],
    ["TreeSet.lower(E e)", "O(log n)|O(lg n)"],
    ["HashMap.get(Object key)", "O(1)"],
    ["PriorityQueue.poll()", "O(log n)|O(lg n)"],
    ["PriorityQueue.remove(Object o)", "O(n)"],
    ["ArrayList.contains(Object o)", "O(n)"],
    ["HashSet.add(Object o)", "O(1)"],
    ["ArrayList.size()", "O(1)"],
  ]).slice(0, scenario === "Mock" ? 6 : 5);

  return quizProblem({
    id: `API-${seed}`,
    kind: "api-runtime",
    title: "Java API Runtime Table",
    prompt: "For each Java API operation, write the expected run-time assuming the structure currently has n items. Use Big-O notation like the exam.",
    scenario,
    points: operations.length,
    visual: { type: "runtime-table" },
    quizParts: operations.map(([operation, answer], index) => ({
      id: `api-${index}`,
      label: operation,
      prompt: operation,
      answer,
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    })),
  });
}

function generateRollingMedian(_rng: () => number, seed: number, scenario: Scenario): Problem {
  return quizProblem({
    id: `MED-${seed}`,
    kind: "api-code",
    title: "Rolling Median Code Completion",
    prompt: `Complete the missing Java code so this prints twice the median after each insertion.\n\nPriorityQueue<Integer> left = new PriorityQueue<Integer>(Collections.reverseOrder());\nPriorityQueue<Integer> right = new PriorityQueue<Integer>();\n\n// Decide which side gets val.\nif (val > left.peek())\n    __BLANK_A__;\nelse\n    __BLANK_B__;\n\n// Rebalance.\nif (left.size() > right.size()+1) __BLANK_C__;\nif (right.size() > left.size()+1) __BLANK_D__;\n\n// Print twice the median.\nif (left.size() > right.size())\n    System.out.println(__BLANK_E__);\nelse if (right.size() > left.size())\n    System.out.println(__BLANK_F__);\nelse\n    System.out.println(__BLANK_G__);`,
    scenario,
    points: 15,
    quizParts: [
      { id: "a", label: "Blank A", prompt: "Value goes to larger-half queue", answer: "right.offer(val)" },
      { id: "b", label: "Blank B", prompt: "Value goes to smaller-half queue", answer: "left.offer(val)" },
      { id: "c", label: "Blank C", prompt: "Move one from left to right", answer: "right.offer(left.poll())" },
      { id: "d", label: "Blank D", prompt: "Move one from right to left", answer: "left.offer(right.poll())" },
      { id: "e", label: "Blank E", prompt: "Left side has more items", answer: "2*left.peek()|left.peek()*2" },
      { id: "f", label: "Blank F", prompt: "Right side has more items", answer: "2*right.peek()|right.peek()*2" },
      { id: "g", label: "Blank G", prompt: "Same size", answer: "left.peek()+right.peek()|right.peek()+left.peek()" },
    ],
  });
}

function generateBacktrackingCode(_rng: () => number, seed: number, scenario: Scenario): Problem {
  return quizProblem({
    id: `BT-${seed}`,
    kind: "backtracking-code",
    title: "Prefix Composite Backtracking",
    prompt: `Complete the recursive function from the prefix composite style question.\n\n// cur is a valid prefix-composite of k digits.\npublic static void go(int cur, int k, int n) {\n    if (__BLANK_A__) {\n        __BLANK_B__;\n        return;\n    }\n\n    for (int i=0; i<10; i++)\n        if (__BLANK_C__)\n            __BLANK_D__;\n}\n\npublic static boolean isprime(int n) {\n    for (int i=2; __BLANK_E__; i++)\n        if (n%i == 0) return false;\n    return true;\n}`,
    scenario,
    points: 15,
    quizParts: [
      { id: "a", label: "Blank A", prompt: "Base case", answer: "k == n" },
      { id: "b", label: "Blank B", prompt: "Print completed number", answer: "System.out.println(cur)" },
      { id: "c", label: "Blank C", prompt: "Only recurse if next prefix is composite", answer: "!isprime(10*cur+i)|isprime(10*cur+i) == false" },
      { id: "d", label: "Blank D", prompt: "Recursive call", answer: "go(10*cur+i, k+1, n)" },
      { id: "e", label: "Blank E", prompt: "O(sqrt(n)) loop condition", answer: "i*i<=n|i*i <= n" },
    ],
  });
}

function generateBacktrackingConcept(rng: () => number, seed: number, scenario: Scenario): Problem {
  const variant = pick(rng, ["prune", "magic", "queens"]);
  if (variant === "magic") {
    return quizProblem({
      id: `BTC-${seed}`,
      kind: "backtracking-concept",
      title: "Hexagram Magic Sum Explanation",
      prompt: "The exam asked why the Hexagram magic sum is found by adding the 12 input numbers and dividing by 3. Select the best explanation.",
      scenario,
      points: 5,
      quizParts: [{
        id: "why",
        label: "Reason",
        prompt: "Why divide the total by 3?",
        answer: "Each number appears in exactly two of the six row sums, so 6X = 2*sum and X = sum/3.",
        options: [
          "Each number appears in exactly two of the six row sums, so 6X = 2*sum and X = sum/3.",
          "There are three diagonals, so the average is the total divided by 3.",
          "Backtracking always divides the search space by 3.",
          "The largest three numbers determine the row sum.",
        ],
      }],
    });
  }
  if (variant === "queens") {
    return quizProblem({
      id: `BTQ-${seed}`,
      kind: "backtracking-concept",
      title: "Five Queens Permutation",
      prompt: "Using the exam visualization, the ith integer in the permutation is the row for the queen in column i. Enter the first lexicographic 5-queens solution.",
      scenario,
      points: 5,
      visual: { type: "grid", grid: Array.from({ length: 5 }, () => Array(5).fill("")) },
      quizParts: [{ id: "perm", label: "Permutation", prompt: "Rows by column, comma separated", answer: "1,3,5,2,4|1 3 5 2 4" }],
    });
  }
  return quizProblem({
    id: `BTP-${seed}`,
    kind: "backtracking-concept",
    title: "Tentaizu Pruning Line",
    prompt: "In class, one pruning line was commented out and Tentaizu became much slower. What did that line conceptually do?",
    scenario,
    points: 5,
    quizParts: [{
      id: "prune",
      label: "Short answer",
      prompt: "Choose the best explanation.",
      answer: "It rejected a board as soon as a completed square could no longer have the correct bomb count.",
      options: [
        "It rejected a board as soon as a completed square could no longer have the correct bomb count.",
        "It sorted all possible boards before recursion.",
        "It changed the answer format from recursive to iterative.",
        "It counted every bomb after all recursive calls finished.",
      ],
    }],
  });
}

function generateDsCode(_rng: () => number, seed: number, scenario: Scenario): Problem {
  return quizProblem({
    id: `DSC-${seed}`,
    kind: "ds-code",
    title: "Connected Regions with Disjoint Sets",
    prompt: `Complete the grid connected-regions code. Only right and down neighbors are checked.\n\nfinal public static int[] DX = {0,1};\nfinal public static int[] DY = {1,0};\n\nfor (int i=0; i<r; i++) {\n  for (int j=0; j<c; j++) {\n    for (int k=0; k<2; k++) {\n      int nx = __BLANK_A__;\n      int ny = __BLANK_B__;\n      if (__BLANK_C__) continue;\n      if (__BLANK_D__)\n          __BLANK_E__;\n    }\n  }\n}`,
    scenario,
    points: 15,
    visual: { type: "grid", grid: [["A", "A", "D", "B", "A"], ["A", "A", "D", "B", "B"], ["A", "D", "D", "C", "C"], ["A", "A", "D", "D", "C"]] },
    quizParts: [
      { id: "a", label: "Blank A", prompt: "Neighbor row", answer: "i + DX[k]|i+DX[k]" },
      { id: "b", label: "Blank B", prompt: "Neighbor column", answer: "j + DY[k]|j+DY[k]" },
      { id: "c", label: "Blank C", prompt: "Bounds check", answer: "nx>=r || ny>=c|nx >= r || ny >= c" },
      { id: "d", label: "Blank D", prompt: "Same region check", answer: "g[i][j] == g[nx][ny]|g[i][j]==g[nx][ny]" },
      { id: "e", label: "Blank E", prompt: "Union flattened cells", answer: "dj.union(i*c+j, nx*c+ny)|dj.union(i*c+j,nx*c+ny)" },
    ],
  });
}

function generateSkipConcept(rng: () => number, seed: number, scenario: Scenario): Problem {
  const variant = pick(rng, ["probability", "exception", "size"]);
  if (variant === "probability") {
    return quizProblem({
      id: `SK-${seed}`,
      kind: "skip-concept",
      title: "Skip List Promotion Questions",
      prompt: "Answer the exact style of short skip-list questions from Part D.",
      scenario,
      points: 9,
      quizParts: [
        { id: "x", label: "Suggested integer denominator", prompt: "The suggested fraction 1/x used what integer x?", answer: "4" },
        { id: "y", label: "Suggested irrational denominator", prompt: "The suggested fraction 1/y used what irrational y?", answer: "e" },
        { id: "fast", label: "Fastest in class", prompt: "Which suggested value performed fastest on the large test run?", answer: "4" },
      ],
    });
  }
  if (variant === "exception") {
    return quizProblem({
      id: `SKE-${seed}`,
      kind: "skip-concept",
      title: "Skip List New-Level Exception",
      prompt: "In most circumstances, insertion follows the level k to level k+1 random promotion rule. What is the exception?",
      scenario,
      points: 3,
      quizParts: [{
        id: "exception",
        label: "Exception",
        prompt: "Choose the best answer.",
        answer: "Do not create a new top level when the promoted value would be the only value on that new level.",
        options: [
          "Do not create a new top level when the promoted value would be the only value on that new level.",
          "Never promote values larger than the current maximum.",
          "Only promote a value when it is searched twice.",
          "Delete all lower copies when a value reaches a higher level.",
        ],
      }],
    });
  }
  return quizProblem({
    id: `SKM-${seed}`,
    kind: "skip-concept",
    title: "Skip List Expected Size",
    prompt: "Recall the series n + n/2 + n/4 + ... = 2n. Explain how it relates to skip-list storage.",
    scenario,
    points: 5,
    quizParts: [
      { id: "meaning", label: "Term meaning", prompt: "What does each term represent?", answer: "expected nodes on a level|nodes on each level" },
      { id: "total", label: "Expected total", prompt: "Expected number of physical nodes for n values", answer: "2n|2*n" },
      { id: "space", label: "Space complexity", prompt: "Asymptotic space complexity", answer: "O(n)" },
    ],
  });
}

function generateSkipStructure(rng: () => number, seed: number, scenario: Scenario): Problem {
  const values = shuffle(rng, range(9, 2).map((value) => value * 5)).slice(0, 6).sort((a, b) => a - b);
  const levels = [
    values,
    values.filter((_, index) => index % 2 === 0),
    values.filter((_, index) => index % 4 === 0),
  ].filter((level) => level.length > 0).reverse();
  const target = pick(rng, values);
  const path = levels.map((level) => level.filter((value) => value <= target).at(-1) ?? "head").join(" -> ");
  return quizProblem({
    id: `SKT-${seed}`,
    kind: "skip-structure",
    title: "Skip List Search Trace",
    prompt: `Trace a search for ${target}. At each level, move right while the next value is <= ${target}; otherwise drop down. Enter the landing value on each level from top to bottom, using "head" when no value is reached.`,
    scenario,
    points: 6,
    visual: { type: "skip-list", levels },
    quizParts: [{ id: "path", label: "Search path", prompt: "Top-to-bottom landing values", answer: path }],
  });
}

function generateAnalysis(rng: () => number, seed: number, scenario: Scenario): Problem {
  const variant = pick(rng, ["loop", "series", "notation"]);
  if (variant === "series") {
    const n = pick(rng, [8, 16, 32, 64]);
    return quizProblem({
      id: `ANA-${seed}`,
      kind: "analysis-math",
      title: "Finite and Infinite Series",
      prompt: `Evaluate the growth of the series ${n} + ${n}/2 + ${n}/4 + ... and connect it to asymptotic notation.`,
      scenario,
      points: 5,
      quizParts: [
        { id: "sum", label: "Infinite sum", prompt: "What does n + n/2 + n/4 + ... equal?", answer: "2n|2*n" },
        { id: "bound", label: "Big-O", prompt: "What is the asymptotic bound?", answer: "O(n)" },
      ],
    });
  }
  if (variant === "notation") {
    return quizProblem({
      id: `NOT-${seed}`,
      kind: "analysis-math",
      title: "Asymptotic Notation Definitions",
      prompt: "Match the notation to its meaning. The professor specifically mentioned Big-O, Big-Omega, Big-Theta, and why Theta is used less often.",
      scenario,
      points: 8,
      quizParts: [
        { id: "o", label: "Big-O", prompt: "Big-O gives an asymptotic...", answer: "upper bound", options: ["upper bound", "lower bound", "exact bound", "random bound"] },
        { id: "omega", label: "Big-Omega", prompt: "Big-Omega gives an asymptotic...", answer: "lower bound", options: ["upper bound", "lower bound", "syntax rule", "hash rule"] },
        { id: "theta", label: "Big-Theta", prompt: "Big-Theta means...", answer: "both upper and lower bound|tight bound", options: ["both upper and lower bound", "only upper bound", "only lower bound", "always constant"] },
      ],
    });
  }
  return quizProblem({
    id: `RUN-${seed}`,
    kind: "analysis-math",
    title: "Runtime of Code",
    prompt: `Find the runtime of the code.\n\nfor (int i=1; i<=n; i*=2) {\n    for (int j=0; j<n; j++) {\n        sum++;\n    }\n}`,
    scenario,
    points: 5,
    quizParts: [
      { id: "outer", label: "Outer loop count", prompt: "How many times does the outer loop run?", answer: "O(log n)|log n|lg n" },
      { id: "total", label: "Total runtime", prompt: "Total runtime", answer: "O(n log n)|O(n lg n)" },
    ],
  });
}

function generateDsArray(rng: () => number, seed: number, scenario: Scenario): Problem {
  const settings = {
    Basic: { sizes: [8], opCounts: [5, 6] },
    Worksheet: { sizes: [10], opCounts: [8, 9] },
    Runtime: { sizes: [10], opCounts: [8, 9] },
    Code: { sizes: [10], opCounts: [8, 9] },
    Concept: { sizes: [10], opCounts: [8, 9] },
    Trace: { sizes: [10], opCounts: [8, 9] },
    Math: { sizes: [10], opCounts: [8, 9] },
    Mock: { sizes: [10], opCounts: [8, 9] },
    Overflow: { sizes: [10], opCounts: [8, 9] },
    Borrow: { sizes: [10], opCounts: [8, 9] },
    Merge: { sizes: [12], opCounts: [10, 11] },
    Root: { sizes: [12], opCounts: [10, 11] },
    Cascade: { sizes: [12, 14], opCounts: [12, 13, 14] },
    Recolor: { sizes: [10], opCounts: [8, 9] },
    SingleRotate: { sizes: [10], opCounts: [8, 9] },
    DoubleRotate: { sizes: [10], opCounts: [8, 9] },
    BlackLeaf: { sizes: [10], opCounts: [8, 9] },
    SiblingRed: { sizes: [10], opCounts: [8, 9] },
  } satisfies Record<Scenario, { sizes: number[]; opCounts: number[] }>;
  const n = pick(rng, settings[scenario].sizes);
  const ds = new DisjointSet(n);
  const operations = Array.from({ length: pick(rng, settings[scenario].opCounts) }, () => {
    const a = Math.floor(rng() * n);
    let b = Math.floor(rng() * n);
    if (a === b) b = (b + 1) % n;
    return [a, b];
  });
  operations.forEach(([a, b]) => ds.union(a, b));
  return {
    id: `DS-${seed}`,
    kind: "ds-array",
    title: "Question 1 Style: Parent Array",
    prompt: `Show the state of the array storing a disjoint set AFTER it has undergone the following operations.\n\nAssume the items in the disjoint set of size n are 0 through n-1. Assume the shorter tree is always attached to the longer tree and that if two trees of equal height are put together the tree with the higher root value is attached to the tree with the lower root value.\n\nDisjointSet dj = new DisjointSet(${n});\n${operations
      .map(([a, b]) => `dj.union(${a}, ${b});`)
      .join("\n")}`,
    scenario,
    trace: ds.trace,
    answerType: "array",
    expectedArray: ds.parent,
    indexes: range(n),
  };
}

function generateTreeInsert(rng: () => number, seed: number, scenario: Scenario): Problem {
  const target =
    scenario === "Basic" || scenario === "Worksheet"
      ? "Place"
      : scenario === "Cascade" || scenario === "Root"
        ? "Split root"
        : "Split";
  const countOptions = scenario === "Basic" ? [5, 6] : scenario === "Overflow" || scenario === "Worksheet" ? [8, 10, 11] : [13, 15, 17];
  const pool = scenario === "Basic" ? 30 : scenario === "Overflow" || scenario === "Worksheet" ? 55 : 90;
  const generated = findTreeOperationCase(rng, countOptions, pool, "insert", target);
  const tree = generated.tree;
  const initial = generated.initial;
  const inserted = generated.value;
  return {
    id: `INS-${seed}`,
    kind: "tree-insert",
    title: `${SCENARIO_LABELS[scenario]} Insertion Drill`,
    prompt: `Insert ${inserted}. Focus on the overflow situation, not just the search path. If a node overflows, send up the third value out of four, matching the worksheet rule.`,
    scenario,
    trace: tree.trace,
    answerType: "tree",
    initialTree: initial,
    expectedTree: tree.root!,
  };
}

function generateTreeDelete(rng: () => number, seed: number, scenario: Scenario): Problem {
  const target =
    scenario === "Borrow"
      ? "Borrow"
      : scenario === "Merge" || scenario === "Cascade"
        ? "Merge"
        : scenario === "Root"
          ? "Root"
          : scenario === "Worksheet"
            ? "Replace"
            : "Delete";
  const countOptions = scenario === "Basic" ? [6, 7] : scenario === "Borrow" || scenario === "Worksheet" ? [10, 12] : [14, 16, 18];
  const pool = scenario === "Basic" ? 35 : scenario === "Borrow" || scenario === "Worksheet" ? 65 : 95;
  const generated = findTreeOperationCase(rng, countOptions, pool, "delete", target);
  const tree = generated.tree;
  const initial = generated.initial;
  const deleted = generated.value;
  return {
    id: `DEL-${seed}`,
    kind: "tree-delete",
    title: `${SCENARIO_LABELS[scenario]} Deletion Drill`,
    prompt: `Delete ${deleted}. Focus on the repair case: borrow when possible, otherwise merge through the parent. Show each tree-changing step.`,
    scenario,
    trace: tree.trace,
    answerType: "tree",
    initialTree: initial,
    expectedTree: tree.root!,
  };
}

function findTreeOperationCase(
  rng: () => number,
  countOptions: number[],
  pool: number,
  operation: "insert" | "delete",
  target: string,
) {
  let fallback: { tree: TwoFourTree; initial: TreeNode; value: number } | null = null;

  for (let attempt = 0; attempt < 90; attempt++) {
    const values = shuffle(rng, range(pool, 3)).slice(0, pick(rng, countOptions));
    const baseTree = new TwoFourTree();
    values.forEach((value) => baseTree.insert(value));
    if (!baseTree.root) continue;

    const initial = cloneTree(baseTree.root);
    const candidates =
      operation === "insert"
        ? range(pool + 20, 3).filter((value) => !values.includes(value))
        : values;

    for (const value of shuffle(rng, candidates)) {
      const testTree = new TwoFourTree();
      values.forEach((item) => testTree.insert(item));
      testTree.trace = [];
      if (operation === "insert") {
        testTree.insert(value);
      } else {
        testTree.delete(value);
      }

      const matches =
        target === "Place"
          ? !testTree.trace.some((event) => event.title.includes("Split"))
          : target === "Delete"
            ? testTree.trace.some((event) => event.title.startsWith("Delete"))
            : testTree.trace.some((event) => event.title.includes(target));

      fallback = fallback ?? { tree: testTree, initial, value };
      if (matches && testTree.root) {
        return { tree: testTree, initial, value };
      }
    }
  }

  return fallback!;
}

function generateRBInsert(rng: () => number, seed: number, scenario: Scenario): Problem {
  const target =
    scenario === "Recolor"
      ? "Recolor"
      : scenario === "SingleRotate"
        ? "Single Rotate"
        : scenario === "DoubleRotate"
          ? "Double Rotate"
          : scenario === "Root"
            ? "Root black"
            : "Insert";
  const countOptions = scenario === "Basic" ? [4, 5] : scenario === "Recolor" ? [5, 6, 7] : [7, 9, 11];
  const generated = findRBOperationCase(rng, countOptions, scenario === "Basic" ? 35 : 80, "insert", target);
  return {
    id: `RBI-${seed}`,
    kind: "rb-insert",
    title: `${SCENARIO_LABELS[scenario]} Red-Black Insertion`,
    prompt: `Insert ${generated.value}. Draw every structural or color-changing step. New keys start red, red-red conflicts are repaired by recoloring when the uncle is red and by rotations when the uncle is black.`,
    scenario,
    trace: generated.tree.trace,
    answerType: "rb",
    initialRBTree: generated.initial,
    expectedRBTree: generated.tree.toNode()!,
  };
}

function generateRBDelete(rng: () => number, seed: number, scenario: Scenario): Problem {
  const target =
    scenario === "BlackLeaf"
      ? "black-height"
      : scenario === "SiblingRed"
        ? "Sibling Red"
        : scenario === "Borrow"
          ? "Borrow"
          : scenario === "DoubleRotate"
            ? "Double Rotate"
            : scenario === "Cascade"
              ? "Cascade"
              : "Delete";
  const countOptions = scenario === "Basic" ? [7, 8] : scenario === "BlackLeaf" || scenario === "SiblingRed" ? [9, 11] : [12, 14, 16];
  const generated = findRBOperationCase(rng, countOptions, scenario === "Basic" ? 45 : 95, "delete", target);
  return {
    id: `RBD-${seed}`,
    kind: "rb-delete",
    title: `${SCENARIO_LABELS[scenario]} Red-Black Deletion`,
    prompt: `Delete ${generated.value}. If the removed node is black, show the black-height repair. Pay attention to the sibling color, inside or outside red children, rotations, and final recoloring.`,
    scenario,
    trace: generated.tree.trace,
    answerType: "rb",
    initialRBTree: generated.initial,
    expectedRBTree: generated.tree.toNode()!,
  };
}

function findRBOperationCase(
  rng: () => number,
  countOptions: number[],
  pool: number,
  operation: "insert" | "delete",
  target: string,
) {
  let fallback: { tree: RedBlackTree; initial: RBNode; value: number } | null = null;

  for (let attempt = 0; attempt < 120; attempt++) {
    const values = shuffle(rng, range(pool, 4)).slice(0, pick(rng, countOptions));
    const baseTree = new RedBlackTree();
    values.forEach((value) => baseTree.insert(value));
    const initial = baseTree.toNode();
    if (!initial) continue;

    const candidates =
      operation === "insert"
        ? range(pool + 25, 4).filter((value) => !values.includes(value))
        : values;

    for (const value of shuffle(rng, candidates)) {
      const testTree = new RedBlackTree();
      values.forEach((item) => testTree.insert(item));
      testTree.trace = [];
      if (operation === "insert") {
        testTree.insert(value);
      } else {
        testTree.delete(value);
      }
      const result = testTree.toNode();
      if (!result) continue;

      const matches =
        target === "Insert"
          ? !testTree.trace.some((event) => event.title.includes("Rotate") || event.title.includes("Recolor"))
          : target === "Delete"
            ? testTree.trace.some((event) => event.title.startsWith("Delete"))
            : target === "black-height"
              ? testTree.trace.some((event) => event.detail.includes("black-height"))
              : testTree.trace.some((event) => event.title.includes(target));

      fallback = fallback ?? { tree: testTree, initial, value };
      if (matches) {
        return { tree: testTree, initial, value };
      }
    }
  }

  if (fallback) return fallback;

  const tree = new RedBlackTree();
  [20, 10, 30, 5, 15].forEach((value) => tree.insert(value));
  const initial = tree.toNode()!;
  tree.trace = [];
  const value = operation === "insert" ? 25 : 5;
  if (operation === "insert") {
    tree.insert(value);
  } else {
    tree.delete(value);
  }
  return { tree, initial, value };
}

function shuffle<T>(rng: () => number, items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function updateTreeNode(root: TreeNode, nodeId: string, updater: (node: TreeNode) => TreeNode): TreeNode {
  if (root.id === nodeId) return updater(root);
  return {
    ...root,
    children: root.children.map((child) => updateTreeNode(child, nodeId, updater)),
  };
}

function addKeyToNode(root: TreeNode, nodeId: string, key: number): TreeNode {
  return updateTreeNode(root, nodeId, (node) => ({
    ...node,
    keys: [...node.keys, key].sort((a, b) => a - b),
  }));
}

function removeKeyFromNode(root: TreeNode, nodeId: string, keyIndex: number): TreeNode {
  return updateTreeNode(root, nodeId, (node) => ({
    ...node,
    keys: node.keys.filter((_, index) => index !== keyIndex),
  }));
}

function addChildToNode(root: TreeNode, nodeId: string): TreeNode {
  return updateTreeNode(root, nodeId, (node) => ({
    ...node,
    children: [...node.children, { id: nextNodeId(), keys: [], children: [] }],
  }));
}

function removeChildFromNode(root: TreeNode, nodeId: string): TreeNode {
  const remove = (node: TreeNode): TreeNode | null => {
    if (node.id === nodeId) return null;
    return {
      ...node,
      children: node.children.map(remove).filter((child): child is TreeNode => child !== null),
    };
  };
  return remove(root) ?? root;
}

function clearChildrenFromNode(root: TreeNode, nodeId: string): TreeNode {
  return updateTreeNode(root, nodeId, (node) => ({
    ...node,
    children: [],
  }));
}

function moveKey(root: TreeNode, fromId: string, fromIndex: number, toId: string): TreeNode {
  let movedKey: number | null = null;
  const withoutKey = updateTreeNode(root, fromId, (node) => {
    movedKey = node.keys[fromIndex];
    return {
      ...node,
      keys: node.keys.filter((_, index) => index !== fromIndex),
    };
  });
  if (movedKey === null) return root;
  return addKeyToNode(withoutKey, toId, movedKey);
}

function updateRBNode(root: RBNode, nodeId: string, updater: (node: RBNode) => RBNode): RBNode {
  if (root.id === nodeId) return updater(root);
  return {
    ...root,
    left: root.left ? updateRBNode(root.left, nodeId, updater) : null,
    right: root.right ? updateRBNode(root.right, nodeId, updater) : null,
  };
}

function addRBChild(root: RBNode, nodeId: string, side: "left" | "right", key: number, color: RBColor): RBNode {
  return updateRBNode(root, nodeId, (node) => ({
    ...node,
    [side]: node[side] ?? { id: nextNodeId(), key, color, left: null, right: null },
  }));
}

function attachRBSubtree(
  root: RBNode,
  nodeId: string,
  side: "left" | "right",
  subtree: RBNode,
): { tree: RBNode; replaced: RBNode | null } {
  let replaced: RBNode | null = null;
  const tree = updateRBNode(root, nodeId, (node) => {
    replaced = node[side] ? cloneRBTree(node[side]) : null;
    return { ...node, [side]: cloneRBTree(subtree)! };
  });
  return { tree, replaced };
}

function setRBColor(root: RBNode, nodeId: string, color: RBColor): RBNode {
  return updateRBNode(root, nodeId, (node) => ({ ...node, color }));
}

function findRBNode(root: RBNode | null, nodeId: string): RBNode | null {
  if (!root) return null;
  if (root.id === nodeId) return root;
  return findRBNode(root.left, nodeId) ?? findRBNode(root.right, nodeId);
}

function removeRBNode(root: RBNode, nodeId: string): RBNode | null {
  if (root.id === nodeId) return null;
  return {
    ...root,
    left: root.left?.id === nodeId ? null : root.left ? removeRBNode(root.left, nodeId) : null,
    right: root.right?.id === nodeId ? null : root.right ? removeRBNode(root.right, nodeId) : null,
  };
}

function detachRBNode(root: RBNode, nodeId: string): { tree: RBNode | null; detached: RBNode | null } {
  const detached = findRBNode(root, nodeId);
  if (!detached) return { tree: root, detached: null };
  return {
    tree: removeRBNode(root, nodeId),
    detached: cloneRBTree(detached),
  };
}

function readDragPayload(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData("application/json");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function writeDragPayload(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData("application/json", JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
}

function App() {
  const [topic, setTopic] = useState<Topic>(() => {
    const saved = localStorage.getItem("structure-practice-topic") as Topic | null;
    return saved && TOPICS.some((item) => item.id === saved) ? saved : "sets";
  });
  const [scenario, setScenario] = useState<Scenario>(() => {
    const saved = localStorage.getItem("structure-practice-scenario") as Scenario | null;
    return saved && Object.hasOwn(SCENARIO_LABELS, saved) ? saved : "Worksheet";
  });
  const [seed, setSeed] = useState(() => {
    const saved = Number(localStorage.getItem("structure-practice-seed"));
    return Number.isFinite(saved) && saved > 0 ? saved : Date.now();
  });
  const [arrayAnswer, setArrayAnswer] = useState<number[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [treeSteps, setTreeSteps] = useState<TreeNode[]>([]);
  const [rbSteps, setRbSteps] = useState<RBNode[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentRBStep, setCurrentRBStep] = useState(0);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState<Stats>(() => {
    const saved = localStorage.getItem("structure-practice-stats");
    return saved ? JSON.parse(saved) : emptyStats;
  });

  const availableScenarios = SCENARIOS[topic];
  const activeScenario = availableScenarios.includes(scenario) ? scenario : availableScenarios[0];
  const problem = useMemo(() => generateProblem(topic, seed, activeScenario), [topic, seed, activeScenario]);

  useEffect(() => {
    localStorage.setItem("structure-practice-stats", JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem("structure-practice-topic", topic);
    localStorage.setItem("structure-practice-scenario", activeScenario);
    localStorage.setItem("structure-practice-seed", String(seed));
  }, [topic, activeScenario, seed]);

  useEffect(() => {
    setResult("idle");
    setShowAnswer(false);
    if (problem.answerType === "array") {
      setArrayAnswer(Array(problem.expectedArray?.length ?? 0).fill(Number.NaN));
      setQuizAnswers({});
      setTreeSteps([]);
      setRbSteps([]);
      setCurrentStep(0);
      setCurrentRBStep(0);
    } else if (problem.answerType === "tree") {
      setArrayAnswer([]);
      setQuizAnswers({});
      setTreeSteps(problem.initialTree ? [cloneTree(problem.initialTree)] : []);
      setRbSteps([]);
      setCurrentStep(0);
      setCurrentRBStep(0);
    } else if (problem.answerType === "rb") {
      setArrayAnswer([]);
      setQuizAnswers({});
      setTreeSteps([]);
      setRbSteps(problem.initialRBTree ? [cloneRBTree(problem.initialRBTree)!] : []);
      setCurrentStep(0);
      setCurrentRBStep(0);
    } else {
      setArrayAnswer([]);
      setQuizAnswers(Object.fromEntries((problem.quizParts ?? []).map((part) => [part.id, ""])));
      setTreeSteps([]);
      setRbSteps([]);
      setCurrentStep(0);
      setCurrentRBStep(0);
    }
  }, [problem]);

  const checkAnswer = () => {
    const correct =
      problem.answerType === "array"
        ? JSON.stringify(arrayAnswer) === JSON.stringify(problem.expectedArray)
        : problem.answerType === "tree"
          ? normalizeTree(treeSteps[treeSteps.length - 1] ?? null) === normalizeTree(problem.expectedTree ?? null)
          : problem.answerType === "rb"
            ? normalizeRBTree(rbSteps[rbSteps.length - 1] ?? null) === normalizeRBTree(problem.expectedRBTree ?? null)
            : (problem.quizParts ?? []).every((part) => quizMatches(quizAnswers[part.id] ?? "", part.answer));

    setResult(correct ? "correct" : "wrong");
    setStats((current) => {
      const streak = correct ? current.streak + 1 : 0;
      return {
        attempted: current.attempted + 1,
        correct: current.correct + (correct ? 1 : 0),
        streak,
        bestStreak: Math.max(current.bestStreak, streak),
      };
    });
  };

  const nextProblem = () => {
    setSeed(Date.now() + Math.floor(Math.random() * 100000));
  };

  const accuracy = stats.attempted === 0 ? 0 : Math.round((stats.correct / stats.attempted) * 100);
  const explanation = buildExplanation(problem);
  const answerMode =
    problem.answerType === "array"
      ? "Array answer"
      : problem.answerType === "tree"
        ? "2-4 tree drawing"
        : problem.answerType === "rb"
          ? "Red-black tree drawing"
          : "Exam-style blanks";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">COP 3503C</p>
          <h1>Structure Practice</h1>
        </div>
        <nav className="topic-list">
          {TOPICS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={topic === item.id ? "topic active" : "topic"}
                key={item.id}
                onClick={() => {
                  setTopic(item.id);
                  setScenario(SCENARIOS[item.id][0]);
                }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <section className="stats">
          <div className="stat-primary">
            <span>{accuracy}%</span>
            <p>accuracy</p>
          </div>
          <div className="stat-grid">
            <div>
              <strong>{stats.correct}/{stats.attempted}</strong>
              <span>correct</span>
            </div>
            <div>
              <strong>{stats.streak}</strong>
              <span>streak</span>
            </div>
            <div>
              <strong>{stats.bestStreak}</strong>
              <span>best</span>
            </div>
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="problem-title">
            <p className="eyebrow">{problem.id} · {SCENARIO_LABELS[problem.scenario]}</p>
            <h2>{problem.title}</h2>
            <div className="meta-row">
              <span>{answerMode}</span>
              <span>{problem.points ?? problem.trace.length} pts</span>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="scenario-control" aria-label="Practice scenario">
              {availableScenarios.map((level) => (
                <button
                  className={activeScenario === level ? "scenario active" : "scenario"}
                  key={level}
                  onClick={() => {
                    setScenario(level);
                  }}
                >
                  {SCENARIO_LABELS[level]}
                </button>
              ))}
            </div>
            <button className="icon-button" onClick={nextProblem} title="New problem">
              <RotateCcw size={18} />
            </button>
          </div>
        </header>

        <section className="problem-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Prompt</p>
              <h3>Starting point</h3>
            </div>
          </div>
          <pre>{problem.prompt}</pre>
          {problem.initialArray && (
            <ArrayView indexes={problem.indexes ?? []} values={problem.initialArray} />
          )}
          {problem.initialTree && <TreeView root={problem.initialTree} label="Starting tree" />}
          {problem.initialRBTree && <RBTreeView root={problem.initialRBTree} label="Starting tree" />}
          {problem.visual && <ProblemVisual visual={problem.visual} />}
        </section>

        <section className="answer-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Workspace</p>
              <h3>Your answer</h3>
            </div>
            <div className="panel-tools">
              <button className="secondary" onClick={() => setShowAnswer(true)}>
                Show answer
              </button>
              <button className="primary" onClick={checkAnswer}>Check</button>
            </div>
          </div>
          {problem.answerType === "array" ? (
            <ArrayAnswer
              indexes={problem.indexes ?? []}
              values={arrayAnswer}
              onChange={setArrayAnswer}
            />
          ) : problem.answerType === "tree" ? (
            <TreeStepBuilder
              steps={treeSteps}
              currentStep={currentStep}
              onCurrentStepChange={setCurrentStep}
              onStepsChange={setTreeSteps}
            />
          ) : problem.answerType === "rb" ? (
            <RBStepBuilder
              steps={rbSteps}
              currentStep={currentRBStep}
              onCurrentStepChange={setCurrentRBStep}
              onStepsChange={setRbSteps}
            />
          ) : (
            <QuizAnswer
              parts={problem.quizParts ?? []}
              values={quizAnswers}
              onChange={setQuizAnswers}
            />
          )}
          {result !== "idle" && (
            <div className={result === "correct" ? "result correct" : "result wrong"}>
              {result === "correct" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {result === "correct" ? "Correct" : "Not yet"}
            </div>
          )}
        </section>
      </section>

      {showAnswer && (
        <AnswerModal
          explanation={explanation}
          onClose={() => setShowAnswer(false)}
          problem={problem}
        />
      )}
    </main>
  );
}

function buildExplanation(problem: Problem) {
  if (problem.answerType === "quiz") {
    return {
      heading: "Rubric and expected answers",
      summary: "These are graded like the old exam PDFs: most blanks are all-or-nothing, and short answers need the core idea even if the wording differs.",
      steps: (problem.quizParts ?? []).map((part, index) => ({
        title: `${index + 1}. ${part.label}`,
        detail: part.answer.replaceAll("|", " or "),
      })),
    };
  }

  if (problem.answerType === "array") {
    return {
      heading: "How the parent array is built",
      summary: "Work through the unions in order. Each union compares the current roots, attaches the shorter tree under the taller tree, and uses the lower root when heights tie.",
      steps: problem.trace.map((event, index) => ({
        title: `Step ${index + 1}: ${event.title}`,
        detail: event.detail,
      })),
    };
  }

  const summary =
    problem.kind === "tree-insert"
      ? "First find the leaf where the new key belongs. The important part is what happens after placement: if a node has four keys, split it and send the third value upward."
      : problem.kind === "tree-delete"
        ? "First remove or replace the target key. The important part is repairing any child with too few keys: borrow from a sibling when possible, otherwise merge through the parent."
        : problem.kind === "rb-insert"
          ? "Insert the new key as red. If that creates a red parent with a red child, repair by checking the uncle: recolor for a red uncle, rotate for a black uncle, and finish with a black root."
          : "After deletion, only black-height changes need repair. Work from the missing black position, inspect the sibling, then recolor or rotate until every root-to-leaf path has the same black count.";

  return {
    heading: "What changes at each tree step",
    summary,
    steps: problem.trace.map((event, index) => ({
      title: `Step ${index + 1}: ${event.title}`,
      detail: event.detail,
    })),
  };
}

function AnswerModal({
  problem,
  explanation,
  onClose,
}: {
  problem: Problem;
  explanation: { heading: string; summary: string; steps: { title: string; detail: string }[] };
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="answer-title"
        aria-modal="true"
        className="answer-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">{problem.id} · {problem.scenario}</p>
            <h2 id="answer-title">Answer and explanation</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="Close answer">
            <XCircle size={18} />
          </button>
        </header>

        <section className="modal-section">
          <h3>Expected answer</h3>
          {problem.answerType === "array" ? (
            <ArrayView indexes={problem.indexes ?? []} values={problem.expectedArray ?? []} />
          ) : problem.answerType === "tree" ? (
            problem.expectedTree && <TreeView root={problem.expectedTree} label="Final tree" />
          ) : problem.answerType === "rb" ? (
            problem.expectedRBTree && <RBTreeView root={problem.expectedRBTree} label="Final tree" />
          ) : (
            <ExpectedQuiz parts={problem.quizParts ?? []} />
          )}
        </section>

        <section className="modal-section">
          <h3>{explanation.heading}</h3>
          <p className="modal-summary">{explanation.summary}</p>
          <ol className="explanation-list">
            {explanation.steps.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </li>
            ))}
          </ol>
        </section>
      </section>
    </div>
  );
}

function ProblemVisual({ visual }: { visual: NonNullable<Problem["visual"]> }) {
  if (visual.type === "skip-list" && visual.levels) {
    return (
      <div className="skip-visual">
        {visual.levels.map((level, index) => (
          <div className="skip-level" key={`level-${index}`}>
            <span className="skip-label">L{visual.levels!.length - index - 1}</span>
            <span className="skip-node sentinel">head</span>
            {level.map((value) => <span className="skip-node" key={`${index}-${value}`}>{value}</span>)}
            <span className="skip-node sentinel">tail</span>
          </div>
        ))}
      </div>
    );
  }

  if (visual.type === "grid" && visual.grid) {
    return (
      <div className="letter-grid" style={{ gridTemplateColumns: `repeat(${visual.grid[0]?.length ?? 1}, 42px)` }}>
        {visual.grid.flatMap((row, rowIndex) =>
          row.map((cell, colIndex) => <div className="letter-cell" key={`${rowIndex}-${colIndex}`}>{cell}</div>),
        )}
      </div>
    );
  }

  return null;
}

function QuizAnswer({
  parts,
  values,
  onChange,
}: {
  parts: QuizPart[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  return (
    <div className="quiz-answer">
      {parts.map((part) => (
        <label className="quiz-part" key={part.id}>
          <span>{part.label}</span>
          <small>{part.prompt}</small>
          {part.options ? (
            <select
              value={values[part.id] ?? ""}
              onChange={(event) => onChange({ ...values, [part.id]: event.target.value })}
            >
              <option value="">Choose an answer</option>
              {part.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : (
            <input
              value={values[part.id] ?? ""}
              onChange={(event) => onChange({ ...values, [part.id]: event.target.value })}
              placeholder="Type the exam-style answer"
            />
          )}
        </label>
      ))}
    </div>
  );
}

function ExpectedQuiz({ parts }: { parts: QuizPart[] }) {
  return (
    <div className="expected-quiz">
      {parts.map((part) => (
        <div key={part.id}>
          <strong>{part.label}</strong>
          <span>{part.answer.replaceAll("|", " or ")}</span>
        </div>
      ))}
    </div>
  );
}

function ArrayView({ indexes, values }: { indexes: number[]; values: number[] }) {
  return (
    <div className="array-grid" style={{ gridTemplateColumns: `88px repeat(${values.length}, minmax(42px, 1fr))` }}>
      <div className="array-label">Index</div>
      {indexes.map((index) => <div className="array-cell muted" key={`i-${index}`}>{index}</div>)}
      <div className="array-label">Value</div>
      {values.map((value, index) => <div className="array-cell" key={`v-${index}`}>{value}</div>)}
    </div>
  );
}

function ArrayAnswer({
  indexes,
  values,
  onChange,
}: {
  indexes: number[];
  values: number[];
  onChange: (values: number[]) => void;
}) {
  return (
    <div className="array-grid answer" style={{ gridTemplateColumns: `88px repeat(${values.length}, minmax(42px, 1fr))` }}>
      <div className="array-label">Index</div>
      {indexes.map((index) => <div className="array-cell muted" key={index}>{index}</div>)}
      <div className="array-label">Value</div>
      {values.map((value, index) => (
        <input
          aria-label={`Value for index ${indexes[index]}`}
          className="array-input"
          key={indexes[index]}
          value={Number.isNaN(value) ? "" : value}
          onChange={(event) => {
            const next = [...values];
            next[index] = event.target.value.trim() === "" ? Number.NaN : Number(event.target.value);
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function RBStepBuilder({
  steps,
  currentStep,
  onCurrentStepChange,
  onStepsChange,
}: {
  steps: RBNode[];
  currentStep: number;
  onCurrentStepChange: (index: number) => void;
  onStepsChange: (steps: RBNode[]) => void;
}) {
  const currentTree = steps[currentStep];
  const [paletteKey, setPaletteKey] = useState("");
  const [paletteColor, setPaletteColor] = useState<RBColor>("red");
  const [looseSubtrees, setLooseSubtrees] = useState<RBNode[]>([]);

  useEffect(() => {
    setLooseSubtrees([]);
  }, [currentStep, steps.length]);

  const updateCurrentTree = (tree: RBNode | null) => {
    if (!tree) {
      onStepsChange(steps.map((step, index) => (index === currentStep ? step : step)));
      return;
    }
    onStepsChange(steps.map((step, index) => (index === currentStep ? tree : step)));
  };

  const addStep = () => {
    if (!currentTree) return;
    const next = [...steps.slice(0, currentStep + 1), cloneRBTree(currentTree)!];
    onStepsChange(next);
    onCurrentStepChange(next.length - 1);
  };

  const removeStep = () => {
    if (steps.length <= 1) return;
    const next = steps.filter((_, index) => index !== currentStep);
    onStepsChange(next);
    onCurrentStepChange(Math.max(0, currentStep - 1));
  };

  if (!currentTree) {
    return <p className="parse-error">No starting red-black tree was generated.</p>;
  }

  const paletteKeyNumber = Number(paletteKey);
  const canDragKey = paletteKey.trim() !== "" && Number.isFinite(paletteKeyNumber);

  const handleTrashDrop = (payload: DragPayload | null) => {
    if (!payload || payload.type !== "rb-node") return;
    const next = removeRBNode(currentTree, payload.nodeId);
    if (next) updateCurrentTree(next);
  };

  const detachToWorkbench = (payload: DragPayload | null) => {
    if (!payload || payload.type !== "rb-node" || payload.nodeId === currentTree.id) return;
    const result = detachRBNode(currentTree, payload.nodeId);
    if (!result.tree || !result.detached) return;
    updateCurrentTree(result.tree);
    setLooseSubtrees((items) => [...items, result.detached!]);
  };

  const attachLooseSubtree = (looseId: string, targetId: string, side: "left" | "right") => {
    const subtree = looseSubtrees.find((item) => item.id === looseId);
    if (!subtree) return;
    const result = attachRBSubtree(currentTree, targetId, side, subtree);
    updateCurrentTree(result.tree);
    setLooseSubtrees((items) => [
      ...items.filter((item) => item.id !== looseId),
      ...(result.replaced ? [result.replaced] : []),
    ]);
  };

  return (
    <div className="tree-builder">
      <div className="step-toolbar">
        <div className="step-tabs" aria-label="Red-black tree answer steps">
          {steps.map((_, index) => (
            <button
              className={index === currentStep ? "step-tab active" : "step-tab"}
              key={index}
              onClick={() => onCurrentStepChange(index)}
            >
              Step {index + 1}
            </button>
          ))}
        </div>
        <div className="step-actions">
          <button className="secondary compact" onClick={addStep}>
            <CirclePlus size={16} />
            Add step
          </button>
          <button className="secondary compact" onClick={removeStep} disabled={steps.length <= 1}>
            Remove step
          </button>
        </div>
      </div>

      <div
        className="trash-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleTrashDrop(readDragPayload(event));
        }}
      >
        <Trash2 size={18} />
        Drop RB nodes here
      </div>

      <div
        className={looseSubtrees.length > 0 ? "detach-drop has-pieces" : "detach-drop"}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          detachToWorkbench(readDragPayload(event));
        }}
      >
        <div>
          <strong>Loose subtrees</strong>
          <span>Drag a non-root node here to detach it, then drop it on an L or R slot.</span>
        </div>
        {looseSubtrees.length > 0 && (
          <div className="loose-subtree-list">
            {looseSubtrees.map((subtree) => (
              <button
                className={`loose-subtree-chip ${subtree.color}`}
                draggable
                key={subtree.id}
                onDragStart={(event) => writeDragPayload(event, { type: "rb-loose-node", looseId: subtree.id })}
                title="Drag this subtree onto a left or right slot."
              >
                {subtree.key}
                {(subtree.left || subtree.right) && <span>subtree</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tree-workbench">
        <aside className="builder-palette">
          <h4>Palette</h4>
          <label>
            Key
            <input
              inputMode="numeric"
              value={paletteKey}
              onChange={(event) => setPaletteKey(event.target.value)}
              placeholder="47"
            />
          </label>
          <div className="color-toggle" aria-label="Palette node color">
            <button className={paletteColor === "red" ? "active" : ""} onClick={() => setPaletteColor("red")}>Red</button>
            <button className={paletteColor === "black" ? "active" : ""} onClick={() => setPaletteColor("black")}>Black</button>
          </div>
          <button
            className={`rb-palette-chip ${paletteColor}`}
            draggable={canDragKey}
            disabled={!canDragKey}
            onDragStart={(event) => writeDragPayload(event, { type: "rb-palette-node", key: paletteKeyNumber, color: paletteColor })}
          >
            {canDragKey ? paletteKeyNumber : "Set key"}
          </button>
        </aside>

        <div>
          <p className="hint">Drag a node to Loose subtrees to detach it. Drag loose subtrees back onto L or R slots. Dropping onto a filled slot swaps the old child into the loose area.</p>
          <EditableRBTree root={currentTree} onChange={updateCurrentTree} onAttachLoose={attachLooseSubtree} />
        </div>
      </div>
    </div>
  );
}

function EditableRBTree({
  root,
  onChange,
  onAttachLoose,
}: {
  root: RBNode;
  onChange: (tree: RBNode | null) => void;
  onAttachLoose: (looseId: string, targetId: string, side: "left" | "right") => void;
}) {
  const layout = buildRBTreeLayout(root);

  return (
    <div className="tree-canvas" aria-label="Red-black tree drawing canvas">
      <div className="tree-stage" style={{ width: layout.width, height: layout.height + 30 }}>
        <svg className="tree-lines" width={layout.width} height={layout.height + 30} aria-hidden="true">
          {layout.lines.map((line, index) => (
            <line key={`${line.x1}-${line.x2}-${index}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
          ))}
        </svg>
        {layout.nodes.map((layoutNode) => (
          <EditableRBNode
            key={layoutNode.node.id}
            root={root}
            node={layoutNode.node}
            layoutNode={layoutNode}
            onChange={onChange}
            onAttachLoose={onAttachLoose}
          />
        ))}
      </div>
    </div>
  );
}

function EditableRBNode({
  root,
  node,
  layoutNode,
  onChange,
  onAttachLoose,
}: {
  root: RBNode;
  node: RBNode;
  layoutNode: RBLayoutNode;
  onChange: (tree: RBNode | null) => void;
  onAttachLoose: (looseId: string, targetId: string, side: "left" | "right") => void;
}) {
  const dropChild = (side: "left" | "right", payload: DragPayload | null) => {
    if (payload?.type === "rb-palette-node") {
      onChange(addRBChild(root, node.id, side, payload.key, payload.color));
    }
    if (payload?.type === "rb-loose-node") {
      onAttachLoose(payload.looseId, node.id, side);
    }
  };

  return (
    <div
      className="rb-edit-node positioned-node"
      style={{ left: layoutNode.x - layoutNode.width / 2, top: layoutNode.y }}
    >
      <button
        className={`rb-node ${node.color}`}
        draggable
        onDragStart={(event) => writeDragPayload(event, { type: "rb-node", nodeId: node.id })}
        title="Drag to trash to remove this subtree."
      >
        {node.key}
      </button>
      <div className="color-toggle node-colors" aria-label={`Color for ${node.key}`}>
        <button className={node.color === "red" ? "active" : ""} onClick={() => onChange(setRBColor(root, node.id, "red"))}>R</button>
        <button className={node.color === "black" ? "active" : ""} onClick={() => onChange(setRBColor(root, node.id, "black"))}>B</button>
      </div>
      <div className="rb-child-drops">
        {(["left", "right"] as const).map((side) => (
          <div
            className={`rb-drop ${node[side] ? "filled" : ""}`}
            key={side}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              dropChild(side, readDragPayload(event));
            }}
          >
            {side === "left" ? "L" : "R"}
          </div>
        ))}
      </div>
    </div>
  );
}

function TreeStepBuilder({
  steps,
  currentStep,
  onCurrentStepChange,
  onStepsChange,
}: {
  steps: TreeNode[];
  currentStep: number;
  onCurrentStepChange: (index: number) => void;
  onStepsChange: (steps: TreeNode[]) => void;
}) {
  const currentTree = steps[currentStep];
  const [paletteKey, setPaletteKey] = useState("");

  const updateCurrentTree = (tree: TreeNode) => {
    onStepsChange(steps.map((step, index) => (index === currentStep ? tree : step)));
  };

  const addStep = () => {
    if (!currentTree) return;
    const next = [...steps.slice(0, currentStep + 1), cloneTree(currentTree)];
    onStepsChange(next);
    onCurrentStepChange(next.length - 1);
  };

  const removeStep = () => {
    if (steps.length <= 1) return;
    const next = steps.filter((_, index) => index !== currentStep);
    onStepsChange(next);
    onCurrentStepChange(Math.max(0, currentStep - 1));
  };

  if (!currentTree) {
    return <p className="parse-error">No starting tree was generated.</p>;
  }

  const paletteKeyNumber = Number(paletteKey);
  const canDragKey = paletteKey.trim() !== "" && Number.isFinite(paletteKeyNumber);

  const handleTrashDrop = (payload: DragPayload | null) => {
    if (!payload) return;
    if (payload.type === "tree-key") {
      updateCurrentTree(removeKeyFromNode(currentTree, payload.fromId, payload.fromIndex));
    }
    if (payload.type === "tree-node") {
      if (payload.nodeId === currentTree.id) {
        updateCurrentTree(clearChildrenFromNode(currentTree, currentTree.id));
      } else {
        updateCurrentTree(removeChildFromNode(currentTree, payload.nodeId));
      }
    }
  };

  return (
    <div className="tree-builder">
      <div className="step-toolbar">
        <div className="step-tabs" aria-label="Tree answer steps">
          {steps.map((_, index) => (
            <button
              className={index === currentStep ? "step-tab active" : "step-tab"}
              key={index}
              onClick={() => onCurrentStepChange(index)}
            >
              Step {index + 1}
            </button>
          ))}
        </div>
        <div className="step-actions">
          <button className="secondary compact" onClick={addStep}>
            <CirclePlus size={16} />
            Add step
          </button>
          <button className="secondary compact" onClick={removeStep} disabled={steps.length <= 1}>
            Remove step
          </button>
        </div>
      </div>

      <div
        className="trash-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleTrashDrop(readDragPayload(event));
        }}
      >
        <Trash2 size={18} />
        Drop keys or nodes here
      </div>

      <div className="tree-workbench">
        <aside className="builder-palette">
          <h4>Palette</h4>
          <label>
            Key
            <input
              inputMode="numeric"
              value={paletteKey}
              onChange={(event) => setPaletteKey(event.target.value)}
              placeholder="47"
            />
          </label>
          <button
            className="palette-chip"
            draggable={canDragKey}
            disabled={!canDragKey}
            onDragStart={(event) => writeDragPayload(event, { type: "palette-key", key: paletteKeyNumber })}
          >
            {canDragKey ? paletteKeyNumber : "Set key"}
          </button>
          <button
            className="palette-chip child"
            draggable
            onDragStart={(event) => writeDragPayload(event, { type: "new-child" })}
          >
            Empty child
          </button>
        </aside>

        <div>
          <p className="hint">Drag keys or empty children from the palette onto nodes. Drag keys between nodes. Drag a node to trash to remove that whole subtree.</p>
          <EditableTree root={currentTree} onChange={updateCurrentTree} />
        </div>
      </div>
    </div>
  );
}

function EditableTree({ root, onChange }: { root: TreeNode; onChange: (tree: TreeNode) => void }) {
  const layout = buildTreeLayout(root);

  return (
    <div className="tree-canvas" aria-label="B-tree drawing canvas">
      <div className="tree-stage" style={{ width: layout.width, height: layout.height }}>
        <svg className="tree-lines" width={layout.width} height={layout.height} aria-hidden="true">
          {layout.lines.map((line, index) => (
            <line
              key={`${line.x1}-${line.x2}-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          ))}
        </svg>
        {layout.nodes.map((layoutNode) => (
          <EditableTreeNode
            key={layoutNode.node.id}
            root={root}
            node={layoutNode.node}
            onChange={onChange}
            canRemove={layoutNode.node.id !== root.id}
            layoutNode={layoutNode}
          />
        ))}
      </div>
    </div>
  );
}

function EditableTreeNode({
  root,
  node,
  onChange,
  canRemove,
  layoutNode,
}: {
  root: TreeNode;
  node: TreeNode;
  onChange: (tree: TreeNode) => void;
  canRemove: boolean;
  layoutNode: LayoutNode;
}) {
  return (
    <div
      className="edit-node positioned-node"
      draggable
      style={{
        width: layoutNode.width,
        left: layoutNode.x - layoutNode.width / 2,
        top: layoutNode.y,
      }}
      onDragStart={(event) => writeDragPayload(event, { type: "tree-node", nodeId: node.id })}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const payload = readDragPayload(event);
        if (!payload) return;
        if (payload.type === "palette-key") {
          onChange(addKeyToNode(root, node.id, payload.key));
        }
        if (payload.type === "tree-key") {
          onChange(moveKey(root, payload.fromId, payload.fromIndex, node.id));
        }
        if (payload.type === "new-child") {
          onChange(addChildToNode(root, node.id));
        }
      }}
    >
      <div className="key-row">
        {node.keys.length === 0 && <span className="empty-node">empty</span>}
        {node.keys.map((key, index) => (
          <button
            className="key-chip"
            draggable
            key={`${node.id}-${key}-${index}`}
            onDragStart={(event) => {
              event.stopPropagation();
              writeDragPayload(event, { type: "tree-key", fromId: node.id, fromIndex: index });
            }}
            title="Drag to another node or to trash."
          >
            {key}
          </button>
        ))}
      </div>
      <div className="node-caption">{canRemove ? "Drag node to trash" : "Root: drop child here"}</div>
    </div>
  );
}

function TreeView({ root, label }: { root: TreeNode; label: string }) {
  const layout = buildTreeLayout(root);

  return (
    <div className="tree-view">
      <p>{label}</p>
      <div className="tree-stage" style={{ width: layout.width, height: layout.height }}>
        <svg className="tree-lines" width={layout.width} height={layout.height} aria-hidden="true">
          {layout.lines.map((line, index) => (
            <line
              key={`${line.x1}-${line.x2}-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          ))}
        </svg>
        {layout.nodes.map((layoutNode) => (
          <div
            className="tree-node positioned-node"
            key={layoutNode.node.id}
            style={{
              width: layoutNode.width,
              left: layoutNode.x - layoutNode.width / 2,
              top: layoutNode.y,
            }}
          >
            {layoutNode.node.keys.join(" | ")}
          </div>
        ))}
      </div>
    </div>
  );
}

function RBTreeView({ root, label }: { root: RBNode; label: string }) {
  const layout = buildRBTreeLayout(root);

  return (
    <div className="tree-view">
      <p>{label}</p>
      <div className="tree-stage" style={{ width: layout.width, height: layout.height }}>
        <svg className="tree-lines" width={layout.width} height={layout.height} aria-hidden="true">
          {layout.lines.map((line, index) => (
            <line
              key={`${line.x1}-${line.x2}-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
            />
          ))}
        </svg>
        {layout.nodes.map((layoutNode) => (
          <div
            className={`rb-node positioned-node ${layoutNode.node.color}`}
            key={layoutNode.node.id}
            style={{
              left: layoutNode.x - layoutNode.width / 2,
              top: layoutNode.y,
            }}
          >
            {layoutNode.node.key}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
