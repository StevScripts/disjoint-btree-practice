import {
  Binary,
  CheckCircle2,
  CirclePlus,
  Network,
  RotateCcw,
  Shuffle,
  SplitSquareHorizontal,
  Trash2,
  XCircle,
} from "lucide-react";
import type { DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type Topic = "sets" | "insert" | "delete" | "mixed";
type ProblemKind = "ds-array" | "tree-insert" | "tree-delete";
type Difficulty = "Easy" | "Medium" | "Hard";

type TraceEvent = {
  title: string;
  detail: string;
};

type TreeNode = {
  id: string;
  keys: number[];
  children: TreeNode[];
};

type DragPayload =
  | { type: "palette-key"; key: number }
  | { type: "tree-key"; fromId: string; fromIndex: number }
  | { type: "new-child" }
  | { type: "tree-node"; nodeId: string };

type Problem = {
  id: string;
  kind: ProblemKind;
  title: string;
  prompt: string;
  difficulty: Difficulty;
  trace: TraceEvent[];
  answerType: "array" | "tree";
  expectedArray?: number[];
  initialArray?: number[];
  indexes?: number[];
  initialTree?: TreeNode;
  expectedTree?: TreeNode;
};

type Stats = {
  attempted: number;
  correct: number;
  streak: number;
  bestStreak: number;
};

const TOPICS: { id: Topic; label: string; icon: typeof Network }[] = [
  { id: "sets", label: "Disjoint Sets", icon: Network },
  { id: "insert", label: "2-4 Insert", icon: SplitSquareHorizontal },
  { id: "delete", label: "2-4 Delete", icon: Trash2 },
  { id: "mixed", label: "Mixed Review", icon: Shuffle },
];

const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

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

function treeLevels(root: TreeNode) {
  const rows: TreeNode[][] = [];
  let level = [root];
  while (level.length > 0) {
    rows.push(level);
    level = level.flatMap((node) => node.children);
  }
  return rows;
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

function generateProblem(topic: Topic, seed: number, difficulty: Difficulty): Problem {
  const rng = makeRng(seed);
  const kind =
    topic === "sets"
      ? "ds-array"
      : topic === "insert"
        ? "tree-insert"
        : topic === "delete"
          ? "tree-delete"
          : pick(rng, ["ds-array", "tree-insert", "tree-delete"] as ProblemKind[]);

  if (kind === "ds-array") return generateDsArray(rng, seed, difficulty);
  if (kind === "tree-delete") return generateTreeDelete(rng, seed, difficulty);
  return generateTreeInsert(rng, seed, difficulty);
}

function generateDsArray(rng: () => number, seed: number, difficulty: Difficulty): Problem {
  const settings = {
    Easy: { sizes: [8], opCounts: [5, 6] },
    Medium: { sizes: [10], opCounts: [8, 9] },
    Hard: { sizes: [12, 14], opCounts: [12, 13, 14] },
  } satisfies Record<Difficulty, { sizes: number[]; opCounts: number[] }>;
  const n = pick(rng, settings[difficulty].sizes);
  const ds = new DisjointSet(n);
  const operations = Array.from({ length: pick(rng, settings[difficulty].opCounts) }, () => {
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
    difficulty,
    trace: ds.trace,
    answerType: "array",
    expectedArray: ds.parent,
    indexes: range(n),
  };
}

function generateTreeInsert(rng: () => number, seed: number, difficulty: Difficulty): Problem {
  const settings = {
    Easy: { counts: [5, 6], pool: 30 },
    Medium: { counts: [8, 10], pool: 45 },
    Hard: { counts: [13, 15, 17], pool: 80 },
  } satisfies Record<Difficulty, { counts: number[]; pool: number }>;
  const values = shuffle(rng, range(settings[difficulty].pool, 3)).slice(0, pick(rng, settings[difficulty].counts));
  const tree = new TwoFourTree();
  values.forEach((value) => tree.insert(value));
  const initial = cloneTree(tree.root!);
  const candidates = range(70, 3).filter((value) => !values.includes(value));
  let inserted = pick(rng, candidates);
  if (difficulty !== "Easy") {
    const target = difficulty === "Hard" ? "Split root" : "Split";
    const harderCandidate = shuffle(rng, candidates).find((candidate) => {
      const testTree = new TwoFourTree();
      values.forEach((value) => testTree.insert(value));
      testTree.trace = [];
      testTree.insert(candidate);
      return testTree.trace.some((event) => event.title.includes(target));
    });
    inserted = harderCandidate ?? inserted;
  }
  tree.trace = [];
  tree.insert(inserted);
  return {
    id: `INS-${seed}`,
    kind: "tree-insert",
    title: "2-4 Tree Insertion",
    prompt: `Insert ${inserted}. If a node overflows, send up the third value out of four, matching the worksheet rule.`,
    difficulty,
    trace: tree.trace,
    answerType: "tree",
    initialTree: initial,
    expectedTree: tree.root!,
  };
}

function generateTreeDelete(rng: () => number, seed: number, difficulty: Difficulty): Problem {
  const settings = {
    Easy: { counts: [6, 7], pool: 35 },
    Medium: { counts: [10, 12], pool: 65 },
    Hard: { counts: [14, 16, 18], pool: 95 },
  } satisfies Record<Difficulty, { counts: number[]; pool: number }>;
  const values = shuffle(rng, range(settings[difficulty].pool, 3)).slice(0, pick(rng, settings[difficulty].counts));
  const tree = new TwoFourTree();
  values.forEach((value) => tree.insert(value));
  const initial = cloneTree(tree.root!);
  let deleted = pick(rng, values);
  if (difficulty !== "Easy") {
    const targetWords = difficulty === "Hard" ? ["Merge", "Root"] : ["Borrow", "Replace"];
    const harderCandidate = shuffle(rng, values).find((candidate) => {
      const testTree = new TwoFourTree();
      values.forEach((value) => testTree.insert(value));
      testTree.trace = [];
      testTree.delete(candidate);
      return testTree.trace.some((event) => targetWords.some((word) => event.title.includes(word)));
    });
    deleted = harderCandidate ?? deleted;
  }
  tree.trace = [];
  tree.delete(deleted);
  return {
    id: `DEL-${seed}`,
    kind: "tree-delete",
    title: "2-4 Tree Deletion",
    prompt: `Delete ${deleted}. Repair underflow by borrowing from a sibling when possible; otherwise merge through the parent.`,
    difficulty,
    trace: tree.trace,
    answerType: "tree",
    initialTree: initial,
    expectedTree: tree.root!,
  };
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
  const [topic, setTopic] = useState<Topic>("sets");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [seed, setSeed] = useState(() => Date.now());
  const [arrayAnswer, setArrayAnswer] = useState<number[]>([]);
  const [treeSteps, setTreeSteps] = useState<TreeNode[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState<Stats>(() => {
    const saved = localStorage.getItem("structure-practice-stats");
    return saved ? JSON.parse(saved) : emptyStats;
  });

  const problem = useMemo(() => generateProblem(topic, seed, difficulty), [topic, seed, difficulty]);

  useEffect(() => {
    localStorage.setItem("structure-practice-stats", JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    setResult("idle");
    setShowAnswer(false);
    if (problem.answerType === "array") {
      setArrayAnswer(Array(problem.expectedArray?.length ?? 0).fill(Number.NaN));
      setTreeSteps([]);
      setCurrentStep(0);
    } else {
      setArrayAnswer([]);
      setTreeSteps(problem.initialTree ? [cloneTree(problem.initialTree)] : []);
      setCurrentStep(0);
    }
  }, [problem]);

  const checkAnswer = () => {
    const correct =
      problem.answerType === "array"
        ? JSON.stringify(arrayAnswer) === JSON.stringify(problem.expectedArray)
        : normalizeTree(treeSteps[treeSteps.length - 1] ?? null) === normalizeTree(problem.expectedTree ?? null);

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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
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
                  setSeed(Date.now());
                }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <section className="stats">
          <span>{accuracy}%</span>
          <p>{stats.correct}/{stats.attempted} correct</p>
          <p>Streak {stats.streak}, best {stats.bestStreak}</p>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{problem.id} · {problem.difficulty}</p>
            <h2>{problem.title}</h2>
          </div>
          <div className="topbar-actions">
            <div className="difficulty-control" aria-label="Difficulty">
              {DIFFICULTIES.map((level) => (
                <button
                  className={difficulty === level ? "difficulty active" : "difficulty"}
                  key={level}
                  onClick={() => {
                    setDifficulty(level);
                    setSeed(Date.now());
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
            <button className="icon-button" onClick={nextProblem} title="New problem">
              <RotateCcw size={18} />
            </button>
          </div>
        </header>

        <section className="problem-panel">
          <pre>{problem.prompt}</pre>
          {problem.initialArray && (
            <ArrayView indexes={problem.indexes ?? []} values={problem.initialArray} />
          )}
          {problem.initialTree && <TreeView root={problem.initialTree} label="Starting tree" />}
        </section>

        <section className="answer-panel">
          <div className="panel-heading">
            <h3>Your answer</h3>
            <Binary size={18} />
          </div>
          {problem.answerType === "array" ? (
            <ArrayAnswer
              indexes={problem.indexes ?? []}
              values={arrayAnswer}
              onChange={setArrayAnswer}
            />
          ) : (
            <TreeStepBuilder
              steps={treeSteps}
              currentStep={currentStep}
              onCurrentStepChange={setCurrentStep}
              onStepsChange={setTreeSteps}
            />
          )}
          <div className="actions">
            <button className="primary" onClick={checkAnswer}>Check</button>
            <button className="secondary" onClick={() => setShowAnswer((value) => !value)}>
              {showAnswer ? "Hide answer" : "Show answer"}
            </button>
          </div>
          {result !== "idle" && (
            <div className={result === "correct" ? "result correct" : "result wrong"}>
              {result === "correct" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              {result === "correct" ? "Correct" : "Not yet"}
            </div>
          )}
        </section>
      </section>

      <aside className="review">
        <h3>Trace</h3>
        <ol>
          {problem.trace.map((event, index) => (
            <li key={`${event.title}-${index}`}>
              <strong>{event.title}</strong>
              <span>{event.detail}</span>
            </li>
          ))}
        </ol>
        {showAnswer && (
          <section className="expected">
            <h3>Expected</h3>
            {problem.answerType === "array" ? (
              <ArrayView indexes={problem.indexes ?? []} values={problem.expectedArray ?? []} />
            ) : (
              problem.expectedTree && <TreeView root={problem.expectedTree} label="Final tree" />
            )}
          </section>
        )}
      </aside>
    </main>
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
  return (
    <div className="tree-canvas" aria-label="B-tree drawing canvas">
      <EditableTreeNode root={root} node={root} onChange={onChange} canRemove={false} />
    </div>
  );
}

function EditableTreeNode({
  root,
  node,
  onChange,
  canRemove,
}: {
  root: TreeNode;
  node: TreeNode;
  onChange: (tree: TreeNode) => void;
  canRemove: boolean;
}) {
  return (
    <div className="edit-node-wrap">
      <div
        className="edit-node"
        draggable
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

      {node.children.length > 0 && (
        <div className="edit-children">
          {node.children.map((child) => (
            <EditableTreeNode
              canRemove
              key={child.id}
              root={root}
              node={child}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeView({ root, label }: { root: TreeNode; label: string }) {
  return (
    <div className="tree-view">
      <p>{label}</p>
      <ReadOnlyTreeNode node={root} />
    </div>
  );
}

function ReadOnlyTreeNode({ node }: { node: TreeNode }) {
  return (
    <div className="readonly-node-wrap">
      <div className="tree-node">{node.keys.join(" | ")}</div>
      {node.children.length > 0 && (
        <div className="readonly-children">
          {node.children.map((child) => (
            <ReadOnlyTreeNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
