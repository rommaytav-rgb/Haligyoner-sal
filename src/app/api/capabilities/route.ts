import { NextResponse } from "next/server";
import { capabilities } from "@/lib/config";
import { listTools } from "@/server/tools";
import { listActionProviders } from "@/server/services/action-providers";
import { getAIProvider } from "@/server/ai";

/** What this deployment can actually do. Powers the Settings screen (section 23). */
export async function GET() {
  const provider = getAIProvider();
  return NextResponse.json({
    capabilities,
    aiProvider: { name: provider.name, ...provider.quality },
    tools: listTools(),
    actionProviders: listActionProviders(),
  });
}
