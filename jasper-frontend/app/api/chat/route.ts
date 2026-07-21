import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ML_API = process.env.NEXT_PUBLIC_ML_API_BASE_URL ?? "";
const ML_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

function mlHeaders() {
  return { "X-API-Key": ML_KEY, "Content-Type": "application/json" };
}

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

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    if (name === "run_erosion_simulation") {
      const params = new URLSearchParams({
        sector_id: String(input.sector_id),
        slope_deg: input.slope_deg ? String(input.slope_deg) : "38.5",
        rainfall_mm: input.rainfall_mm ? String(input.rainfall_mm) : "82.0",
      });
      const res = await fetch(`${ML_API}/api/v1/simulate/erosion?${params}`, {
        headers: mlHeaders(),
        signal: ctrl.signal,
      });
      if (!res.ok) return JSON.stringify({ error: `ML service returned ${res.status}` });
      return JSON.stringify(await res.json());
    }
    if (name === "run_contaminant_simulation") {
      const params = new URLSearchParams({
        sector_id: String(input.sector_id),
        flow_direction_deg: input.flow_direction_deg ? String(input.flow_direction_deg) : "180",
        water_velocity_ms: input.water_velocity_ms ? String(input.water_velocity_ms) : "2.1",
        contamination_level: "0.72",
      });
      const res = await fetch(`${ML_API}/api/v1/simulate/contaminant?${params}`, {
        headers: mlHeaders(),
        signal: ctrl.signal,
      });
      if (!res.ok) return JSON.stringify({ error: `ML service returned ${res.status}` });
      return JSON.stringify(await res.json());
    }
    if (name === "run_change_detection") {
      const res = await fetch(`${ML_API}/api/v1/predict/change-detection`, {
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

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { reply: "ANTHROPIC_API_KEY is not configured. Add it to .env.local to enable the AI assistant." },
      { status: 503 }
    );
  }

  try {
    const { messages } = (await req.json()) as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools,
      messages: anthropicMessages,
    });

    // Agentic loop — keep running until no more tool calls
    while (response.stop_reason === "tool_use") {
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (block) => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input as Record<string, unknown>),
        }))
      );

      anthropicMessages.push({ role: "assistant", content: response.content });
      anthropicMessages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools,
        messages: anthropicMessages,
      });
    }

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
