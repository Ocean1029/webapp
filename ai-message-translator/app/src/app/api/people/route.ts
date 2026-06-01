import { NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { ensureMigrated } from "@/lib/ensure-migrated";

const LAMBDA = 0.05;
const MS_PER_DAY = 86400000;

export async function GET() {
  try {
    await ensureMigrated();
    const sql = getSQL();

    // Load all aliases: alias → canonical
    const aliasRows = await sql`SELECT canonical_name, alias FROM contact_aliases`;
    const aliasToCanonical = new Map<string, string>();
    const canonicalToAliases = new Map<string, string[]>();
    for (const row of aliasRows) {
      aliasToCanonical.set((row.alias as string).toLowerCase(), row.canonical_name as string);
      const key = (row.canonical_name as string).toLowerCase();
      if (!canonicalToAliases.has(key)) canonicalToAliases.set(key, []);
      canonicalToAliases.get(key)!.push(row.alias as string);
    }

    const rows = await sql`
      SELECT
        LOWER(c.contact_name) AS name_key,
        c.contact_name,
        COUNT(a.id)::int AS analysis_count,
        MAX(a.created_at) AS latest_analysis_date,
        json_agg(json_build_object(
          'interest_score', a.interest_score,
          'created_at', a.created_at
        ) ORDER BY a.created_at DESC) AS score_entries
      FROM conversations c
      JOIN analyses a ON a.conversation_id = c.id
      GROUP BY LOWER(c.contact_name), c.contact_name
      ORDER BY MAX(a.created_at) DESC
    `;

    const now = Date.now();

    // Build canonical-keyed map, merging aliases
    const canonicalMap = new Map<string, {
      contactName: string;
      entries: { interest_score: number; created_at: string }[];
      latestDate: string;
    }>();

    for (const row of rows) {
      const nameKey = row.name_key as string;
      // Resolve to canonical
      const resolvedCanonical = aliasToCanonical.get(nameKey) ?? (row.contact_name as string);
      const canonicalKey = resolvedCanonical.toLowerCase();

      if (!canonicalMap.has(canonicalKey)) {
        canonicalMap.set(canonicalKey, {
          contactName: resolvedCanonical,
          entries: [],
          latestDate: row.latest_analysis_date as string,
        });
      }
      const entry = canonicalMap.get(canonicalKey)!;
      entry.entries.push(...(row.score_entries as { interest_score: number; created_at: string }[]));
      if (new Date(row.latest_analysis_date as string) > new Date(entry.latestDate)) {
        entry.latestDate = row.latest_analysis_date as string;
      }
    }

    const people = Array.from(canonicalMap.entries()).map(([key, { contactName, entries, latestDate }]) => {
      let weightSum = 0;
      let scoreSum = 0;
      for (const e of entries) {
        const daysAgo = (now - new Date(e.created_at).getTime()) / MS_PER_DAY;
        const w = Math.exp(-LAMBDA * daysAgo);
        weightSum += w;
        scoreSum += e.interest_score * w;
      }
      return {
        contactName,
        aliases: canonicalToAliases.get(key) ?? [],
        analysisCount: entries.length,
        weightedInterestScore: weightSum > 0 ? Math.round((scoreSum / weightSum) * 10) / 10 : 0,
        latestAnalysisDate: latestDate,
      };
    });

    // Sort by latest analysis date
    people.sort((a, b) =>
      new Date(b.latestAnalysisDate).getTime() - new Date(a.latestAnalysisDate).getTime()
    );

    return NextResponse.json(people);
  } catch (err) {
    console.error("GET /api/people error:", err);
    return NextResponse.json({ error: "failed to fetch people" }, { status: 500 });
  }
}
