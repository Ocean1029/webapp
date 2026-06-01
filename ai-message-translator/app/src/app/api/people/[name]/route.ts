import { NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { ensureMigrated } from "@/lib/ensure-migrated";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const requestedName = decodeURIComponent(name);

  try {
    await ensureMigrated();
    const sql = getSQL();

    // Resolve: is requestedName a canonical, or an alias pointing to a canonical?
    const aliasRow = await sql`
      SELECT canonical_name FROM contact_aliases
      WHERE LOWER(alias) = LOWER(${requestedName})
      LIMIT 1
    `;
    const canonical = aliasRow.length > 0
      ? (aliasRow[0].canonical_name as string)
      : requestedName;

    // Fetch all aliases for this canonical
    const aliasRows = await sql`
      SELECT alias FROM contact_aliases
      WHERE LOWER(canonical_name) = LOWER(${canonical})
      ORDER BY created_at ASC
    `;
    const aliases = aliasRows.map((r) => r.alias as string);

    // Build the name list to query (canonical + all aliases)
    const allNames = [canonical, ...aliases];

    // Fetch all analyses for canonical + aliases
    const analysisRows = await sql`
      SELECT a.id, a.conversation_id, a.tone_mode, a.interest_score,
             a.subtext_translation, a.reply_suggestions, a.summary, a.created_at,
             c.contact_name
      FROM analyses a
      JOIN conversations c ON c.id = a.conversation_id
      WHERE LOWER(c.contact_name) = ANY(${allNames.map((n) => n.toLowerCase())})
      ORDER BY a.created_at DESC
    `;

    const analyses = analysisRows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      contactName: row.contact_name,
      toneMode: row.tone_mode,
      interestScore: row.interest_score,
      subtextTranslation: row.subtext_translation,
      replySuggestions: row.reply_suggestions,
      summary: row.summary,
      createdAt: row.created_at,
    }));

    const insightRows = await sql`
      SELECT overall_analysis, strategy, weighted_interest_score, updated_at
      FROM person_insights
      WHERE LOWER(contact_name) = LOWER(${canonical})
    `;

    const insight = insightRows.length > 0
      ? {
          overallAnalysis: insightRows[0].overall_analysis,
          strategy: insightRows[0].strategy,
          weightedInterestScore: insightRows[0].weighted_interest_score,
          updatedAt: insightRows[0].updated_at,
        }
      : null;

    return NextResponse.json({ contactName: canonical, aliases, analyses, insight });
  } catch (err) {
    console.error("GET /api/people/[name] error:", err);
    return NextResponse.json({ error: "failed to fetch person" }, { status: 500 });
  }
}
