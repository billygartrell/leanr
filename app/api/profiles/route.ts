import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Profile = { id: string; name: string; createdAt: string };

const PROFILES_KEY = "profiles";

function store() {
  return getStore({ name: "setmark-workouts", consistency: "strong" });
}

async function readProfiles(): Promise<Profile[]> {
  return ((await store().get(PROFILES_KEY, { type: "json" })) as Profile[] | null) ?? [];
}

export async function GET() {
  try {
    return Response.json({ profiles: await readProfiles() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load profiles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string };
    const name = body.name?.trim().replace(/\s+/g, " ");
    if (!name || name.length > 40) return Response.json({ error: "Enter a name between 1 and 40 characters." }, { status: 400 });

    const profiles = await readProfiles();
    if (profiles.some((profile) => profile.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return Response.json({ error: "That profile name is already in use." }, { status: 409 });
    }

    const profile: Profile = { id: randomUUID(), name, createdAt: new Date().toISOString() };
    profiles.push(profile);
    await store().setJSON(PROFILES_KEY, profiles);

    // Preserve the original single-user log by assigning it to the first profile.
    if (profiles.length === 1) {
      const legacy = await store().get("training-data", { type: "json" });
      if (legacy) await store().setJSON(`training-data:${profile.id}`, legacy);
    }

    return Response.json({ profile }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create profile." }, { status: 500 });
  }
}
