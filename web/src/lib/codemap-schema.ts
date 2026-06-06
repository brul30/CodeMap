/* ============================================================
   CodeMap — zod schema for the FULL graph (matches lib/data.ts / data.js)

   This is the trust boundary for LLM output. Every Gemini-emitted graph is
   validated here (shape + deterministic invariants) BEFORE it is stored or
   rendered. Icons / kinds / child types are constrained to the exact enums
   the UI understands (see components/Icon.tsx + Canvas.tsx).

   ⚠️ summary + narration MUST be PLAIN TEXT. The UI renders summary via
   dangerouslySetInnerHTML, so any HTML the model emits would be an XSS hole.
   We strip tags defensively in stripHtml() and reject if anything remains.
   ============================================================ */
import { z } from "zod";

/** Icon keys actually defined in components/Icon.tsx that the design uses for nodes/children. */
export const ICON_NAMES = [
  "browser",
  "shield",
  "route",
  "cpu",
  "database",
  "layers",
  "spark",
  "file",
  "folder",
  "table",
  "bucket",
] as const;

export const NODE_KINDS = ["frontend", "layer", "service", "external"] as const;

export const CHILD_TYPES = ["file", "table", "bucket"] as const;

/** True if the string contains anything that looks like an HTML tag. */
export function hasHtml(s: string): boolean {
  return /<[^>]+>/.test(s);
}

/** Best-effort tag stripper used to repair model output before validation. */
export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const plainText = z
  .string()
  .min(1)
  .refine((s) => !hasHtml(s), { message: "must be plain text (no HTML tags)" });

const kebabId = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "id must be kebab-case" });

export const codeFileSchema = z.object({
  name: z.string().min(1),
  loc: z.string().min(1),
  cov: z.number().min(0).max(1),
});

export const nodeChildSchema = z.object({
  name: z.string().min(1),
  type: z.enum(CHILD_TYPES),
  meta: z.string().min(1),
});

export const graphNodeSchema = z.object({
  id: kebabId,
  label: z.string().min(1),
  kind: z.enum(NODE_KINDS),
  sub: z.string().min(1),
  icon: z.enum(ICON_NAMES),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  summary: plainText,
  tech: z.string().min(1),
  files: z.array(codeFileSchema).default([]),
  children: z.array(nodeChildSchema).optional(),
  narration: plainText,
  selectedDefault: z.boolean().optional(),
});

export const graphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1),
});

const kindMetaSchema = z.object({
  label: z.string().min(1),
  sw: z.string().min(1),
});

const voiceScriptItemSchema = z.object({
  query: z.string().min(1),
  node: z.string().min(1),
});

const logLineSchema = z.object({
  t: z.string().optional(),
  tag: z.enum(["system", "agent", "voice", "tts", "ok", "vector", "scan", "warn"]),
  msg: z.string().min(1),
});

export const codeMapGraphSchema = z
  .object({
    repo: z.object({
      owner: z.string().min(1),
      name: z.string().min(1),
      branch: z.string().min(1),
      commit: z.string().min(1),
    }),
    stage: z.object({ w: z.number().positive(), h: z.number().positive() }),
    nodes: z.array(graphNodeSchema).min(1),
    edges: z.array(graphEdgeSchema).default([]),
    kinds: z.object({
      frontend: kindMetaSchema,
      layer: kindMetaSchema,
      service: kindMetaSchema,
      external: kindMetaSchema,
    }),
    voiceScript: z.array(voiceScriptItemSchema).default([]),
    logSeed: z.array(logLineSchema).default([]),
    logStream: z.array(logLineSchema).default([]),
  })
  // ---- deterministic invariants ----
  .superRefine((g, ctx) => {
    // unique node ids
    const ids = new Set<string>();
    for (const n of g.nodes) {
      if (ids.has(n.id)) {
        ctx.addIssue(`duplicate node id: ${n.id}`);
      }
      ids.add(n.id);
    }
    // edges reference existing nodes; no self-loops
    for (const e of g.edges) {
      if (!ids.has(e.from)) {
        ctx.addIssue(`edge.from references missing node: ${e.from}`);
      }
      if (!ids.has(e.to)) {
        ctx.addIssue(`edge.to references missing node: ${e.to}`);
      }
      if (e.from === e.to) {
        ctx.addIssue(`self-loop edge on node: ${e.from}`);
      }
    }
    // voiceScript targets must exist
    for (const v of g.voiceScript) {
      if (!ids.has(v.node)) {
        ctx.addIssue(`voiceScript references missing node: ${v.node}`);
      }
    }
  });

export type ValidatedGraph = z.infer<typeof codeMapGraphSchema>;

/**
 * The subset of the graph we ask Gemini to produce (no layout / no chrome).
 * Layout (x/y/w/stage), kinds palette, and log/voice scaffolding are added
 * deterministically afterward so the model can't break the UI contract.
 */
export const geminiGraphSchema = z
  .object({
    nodes: z
      .array(
        z.object({
          id: kebabId,
          label: z.string().min(1),
          kind: z.enum(NODE_KINDS),
          sub: z.string().min(1),
          icon: z.enum(ICON_NAMES),
          summary: z.string().min(1),
          tech: z.string().min(1),
          files: z.array(codeFileSchema).default([]),
          children: z.array(nodeChildSchema).optional(),
          narration: z.string().min(1),
        }),
      )
      .min(3),
    edges: z
      .array(graphEdgeSchema)
      .default([]),
  })
  .superRefine((g, ctx) => {
    const ids = new Set<string>();
    for (const n of g.nodes) {
      if (ids.has(n.id)) {
        ctx.addIssue(`duplicate node id: ${n.id}`);
      }
      ids.add(n.id);
    }
    for (const e of g.edges) {
      if (!ids.has(e.from)) ctx.addIssue(`edge.from missing node: ${e.from}`);
      if (!ids.has(e.to)) ctx.addIssue(`edge.to missing node: ${e.to}`);
      if (e.from === e.to) ctx.addIssue(`self-loop edge: ${e.from}`);
    }
  });

export type GeminiGraph = z.infer<typeof geminiGraphSchema>;

/**
 * responseSchema handed to Gemini structured output. Plain JSON-schema-ish
 * object (the SDK's Schema type). We still re-validate with zod afterward.
 */
export const geminiResponseSchema = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "kebab-case unique id" },
          label: { type: "string" },
          kind: { type: "string", enum: [...NODE_KINDS] },
          sub: { type: "string", description: "short tech subtitle, e.g. 'Express · Router'" },
          icon: { type: "string", enum: [...ICON_NAMES] },
          summary: { type: "string", description: "1-3 plain-text sentences. NO HTML tags." },
          tech: { type: "string", description: "primary tech, e.g. 'Node.js'" },
          files: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                loc: { type: "string", description: "e.g. '142 LOC'" },
                cov: { type: "number" },
              },
              required: ["name", "loc", "cov"],
            },
          },
          children: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string", enum: [...CHILD_TYPES] },
                meta: { type: "string" },
              },
              required: ["name", "type", "meta"],
            },
          },
          narration: {
            type: "string",
            description: "2-4 spoken sentences for a non-technical listener. NO HTML tags.",
          },
        },
        required: ["id", "label", "kind", "sub", "icon", "summary", "tech", "files", "narration"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string", description: "existing node id" },
          to: { type: "string", description: "existing node id" },
          label: { type: "string", description: "1-2 words, e.g. 'requests'" },
        },
        required: ["from", "to", "label"],
      },
    },
  },
  required: ["nodes", "edges"],
} as const;
