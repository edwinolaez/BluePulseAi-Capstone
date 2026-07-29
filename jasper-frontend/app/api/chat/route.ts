/**
 * app/api/chat/route.ts — Next.js API route for the Jasper AI Research Assistant.
 *
 * This is the backend half of the ResearcherChatPanel.  The browser sends the
 * full conversation history to POST /api/chat, and this handler:
 *   1. Forwards it to the Claude claude-sonnet-4-6 model with a specialist system prompt
 *   2. Runs an agentic tool-use loop — Claude can call any of the three ML
 *      model endpoints (erosion, contaminant, change-detection) as "tools"
 *   3. Returns the final text reply to the browser
 *
 * The system prompt is cached with Anthropic's prompt caching feature
 * (cache_control: ephemeral) to reduce latency and token cost on repeated calls.
 *
 * Environment variables required:
 *   ANTHROPIC_API_KEY            — Claude API key
 *   NEXT_PUBLIC_ML_API_BASE_URL  — Richard's ML backend base URL
 *   NEXT_PUBLIC_API_KEY          — API key for the ML backend
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// Anthropic SDK client — reads the API key from the server-only env variable
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Richard's ML backend — where erosion, contaminant, and burn scar models live
const ML_API = process.env.NEXT_PUBLIC_ML_API_BASE_URL ?? "";
const ML_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

/** Returns auth headers for every request to Richard's ML backend. */
function mlHeaders() {
  return { "X-API-Key": ML_KEY, "Content-Type": "application/json" };
}

/**
 * Tools that Claude is allowed to call during a conversation.
 * Each tool maps to one of Richard's ML API endpoints.  Claude decides
 * on its own which tool to invoke and what parameters to pass.
 */
const tools: Anthropic.Tool[] = [
  {
    name: "run_erosion_simulation",
    description:
      "Run RUSLE-based erosion risk simulation for a sector. Uses live SRTM 30m terrain slope and Environment Canada precipitation data as inputs.",
    input_schema: {
      type: "object",
      properties: {
        sector_id: { type: "string", description: "Sector ID (e.g. ATH-001-H)" },
        rainfall_mm: { type: "number", description: "Rainfall override in mm/day (optional)" },
        slope_deg: { type: "number", description: "Slope angle override in degrees (optional)" },
      },
      required: ["sector_id"],
    },
  },
  {
    name: "run_contaminant_simulation",
    description:
      "Run hydrocarbon contaminant plume tracking for a water sector. Uses WSC Miette River live flow sensor data.",
    input_schema: {
      type: "object",
      properties: {
        sector_id: { type: "string", description: "Water sector ID (e.g. ATH-001-W)" },
        flow_direction_deg: { type: "number", description: "Flow direction override in degrees 0-360 (optional)" },
        water_velocity_ms: { type: "number", description: "Water velocity override in m/s (optional)" },
      },
      required: ["sector_id"],
    },
  },
  {
    name: "run_change_detection",
    description:
      "Run forest burn scar / vegetation change detection for a sector using Sentinel-2 satellite imagery and Random Forest classification.",
    input_schema: {
      type: "object",
      properties: {
        sector_id: { type: "string", description: "Sector ID (e.g. ATH-001-A)" },
      },
      required: ["sector_id"],
    },
  },
];

/**
 * executeTool — calls the appropriate ML endpoint when Claude requests a tool.
 * Returns a JSON string that is fed back into the conversation as a tool_result.
 * A 12-second timeout prevents a hung ML backend from blocking the response.
 *
 * @param name  - tool name as declared in the tools array above
 * @param input - arguments that Claude chose to pass to the tool
 */
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (!ML_API) {
    return JSON.stringify({ error: "ML_API_URL is not configured. Add NEXT_PUBLIC_ML_API_BASE_URL to your environment variables." });
  }
  // Abort the fetch if the ML backend takes longer than 12 seconds
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    if (name === "run_erosion_simulation") {
      const body: Record<string, unknown> = { sector_id: String(input.sector_id) };
      if (input.rainfall_mm) body.rainfall_mm = Number(input.rainfall_mm);
      const res = await fetch(`${ML_API}/simulate/erosion`, {
        method: "POST",
        headers: mlHeaders(),
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) return JSON.stringify({ error: `ML service returned ${res.status}` });
      return JSON.stringify(await res.json());
    }
    if (name === "run_contaminant_simulation") {
      const body = {
        sector_id: String(input.sector_id),
        source_point: { lat: 52.873, lon: -118.052 },
      };
      const res = await fetch(`${ML_API}/simulate/contaminant`, {
        method: "POST",
        headers: mlHeaders(),
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) return JSON.stringify({ error: `ML service returned ${res.status}` });
      return JSON.stringify(await res.json());
    }
    if (name === "run_change_detection") {
      const res = await fetch(`${ML_API}/predict/change-detection`, {
        method: "POST",
        headers: mlHeaders(),
        body: JSON.stringify({ sector_id: String(input.sector_id) }),
        signal: ctrl.signal,
      });
      if (!res.ok) return JSON.stringify({ error: `ML service returned ${res.status}` });
      return JSON.stringify(await res.json());
    }
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM_PROMPT = `You are the Jasper AI Research Assistant — a specialist embedded in Project Jasper, a post-wildfire environmental monitoring platform for the Jasper, Alberta watershed.

You help environmental scientists run and interpret live ML model simulations. You have three tools:

1. run_erosion_simulation — RUSLE-based erosion risk (sector ATH-001-H). Live inputs: SRTM 30m slope + Environment Canada rainfall.
2. run_contaminant_simulation — Hydrocarbon plume tracking (sector ATH-001-W). Live inputs: WSC Miette River flow sensor.
3. run_change_detection — Forest burn scar detection (sector ATH-001-A). Inputs: Sentinel-2 satellite imagery, Random Forest model.

When narrating results:
- Lead with risk_label and risk_score as a percentage (e.g. "High — 74%")
- Cite live_inputs values and their sources directly from the response
- Explain what the score means for field scientists in 1-2 plain sentences
- End every simulation response with: "⚠️ AI estimate — requires expert validation before regulatory use."

Default sectors: ATH-001-A (burn), ATH-001-H (erosion), ATH-001-W (contaminant). If a user doesn't specify a sector, use the default for the simulation type they asked about.

Be concise, scientific, and direct. Never fabricate values — only report what the tool returns.`;

/**
 * POST /api/chat
 * Accepts the full message history from the ResearcherChatPanel, runs it
 * through Claude with the Jasper specialist system prompt, and returns the
 * assistant's final text reply.
 *
 * The handler implements an agentic loop: Claude may request one or more tool
 * calls before producing a final text response.  Each tool call invokes an ML
 * model endpoint, and the result is appended to the conversation before the
 * next Claude call.  The loop exits when stop_reason is no longer "tool_use".
 */
export async function POST(req: NextRequest) {
  // Guard: return a friendly 503 if the API key is missing rather than crashing
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { reply: "ANTHROPIC_API_KEY is not configured. Add it to .env.local to enable the AI assistant." },
      { status: 503 }
    );
  }

  try {
    // The browser sends the full conversation array so Claude has context
    const { messages } = (await req.json()) as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    // Convert the simple {role, content} objects to the Anthropic SDK format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // First call to Claude — uses prompt caching on the system prompt to save tokens
    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      // cache_control: ephemeral tells Anthropic to cache this system prompt for ~5 minutes,
      // dramatically reducing cost and latency on follow-up messages in the same session
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools,
      messages: anthropicMessages,
    });

    // Agentic loop — keep running until Claude has no more tool calls to make
    while (response.stop_reason === "tool_use") {
      // Collect all tool_use blocks from this response (there may be more than one)
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      // Execute all requested tools in parallel for speed
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (block) => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input as Record<string, unknown>),
        }))
      );

      // Append Claude's tool-use turn and then the tool results as a "user" turn
      // This is the Anthropic multi-turn pattern for agentic tool use
      anthropicMessages.push({ role: "assistant", content: response.content });
      anthropicMessages.push({ role: "user", content: toolResults });

      // Call Claude again with the tool results so it can formulate a final answer
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools,
        messages: anthropicMessages,
      });
    }

    // Extract the final text block from Claude's response
    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return NextResponse.json({ reply: text?.text ?? "No response generated." });
  } catch (err) {
    console.error("[/api/chat]", err);
    return NextResponse.json(
      { reply: "Something went wrong contacting the AI service. Please try again." },
      { status: 500 }
    );
  }
}
