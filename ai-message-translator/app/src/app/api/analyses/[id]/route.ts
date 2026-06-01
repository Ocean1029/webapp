import { NextResponse } from "next/server";
import { getSQL } from "@/lib/db";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "invalid analysis ID" }, { status: 400 });
  }

  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT a.id, a.conversation_id, a.tone_mode, a.interest_score,
             a.subtext_translation, a.reply_suggestions, a.summary, a.created_at,
             c.contact_name
      FROM analyses a
      JOIN conversations c ON c.id = a.conversation_id
      WHERE a.id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "analysis not found" }, { status: 404 });
    }

    const row = rows[0];
    return NextResponse.json({
      id: row.id,
      conversationId: row.conversation_id,
      contactName: row.contact_name,
      toneMode: row.tone_mode,
      interestScore: row.interest_score,
      subtextTranslation: row.subtext_translation,
      replySuggestions: row.reply_suggestions,
      summary: row.summary,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error("Get analysis error:", err);
    return NextResponse.json(
      { error: "failed to get analysis" },
      { status: 500 }
    );
  }
}
