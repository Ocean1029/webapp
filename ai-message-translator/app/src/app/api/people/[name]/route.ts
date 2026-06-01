import { NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { ensureMigrated } from "@/lib/ensure-migrated";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const contactName = decodeURIComponent(name);

  try {
    await ensureMigrated();
    const sql = getSQL();

    const analysisRows = await sql`
      SELECT a.id, a.conversation_id, a.tone_mode, a.interest_score,
             a.subtext_translation, a.reply_suggestions, a.summary, a.created_at,
             c.contact_name
      FROM analyses a
      JOIN conversations c ON c.id = a.conversation_id
      WHERE LOWER(c.contact_name) = LOWER(${contactName})
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
      WHERE LOWER(contact_name) = LOWER(${contactName})
    `;

    const insight = insightRows.length > 0
      ? {
          overallAnalysis: insightRows[0].overall_analysis,
          strategy: insightRows[0].strategy,
          weightedInterestScore: insightRows[0].weighted_interest_score,
          updatedAt: insightRows[0].updated_at,
        }
      : null;

    return NextResponse.json({ contactName, analyses, insight });
  } catch (err) {
    console.error("GET /api/people/[name] error:", err);
    return NextResponse.json({ error: "failed to fetch person" }, { status: 500 });
  }
}
