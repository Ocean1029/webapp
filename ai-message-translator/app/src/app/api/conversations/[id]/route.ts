import { NextResponse } from "next/server";
import { getSQL } from "@/lib/db";

// UUID v4 format validation regex.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "invalid conversation ID" },
      { status: 400 }
    );
  }

  try {
    // Fetch the conversation.
    const sql = getSQL();
    const convRows = await sql`
      SELECT id, contact_name, created_at, updated_at
      FROM conversations
      WHERE id = ${id}
    `;

    if (convRows.length === 0) {
      return NextResponse.json(
        { error: "conversation not found" },
        { status: 404 }
      );
    }

    const conv = convRows[0];

    // Fetch all analyses for this conversation.
    const analysisRows = await sql`
      SELECT id, conversation_id, input_type, raw_text, image_url,
             tone_mode, interest_score, subtext_translation,
             reply_suggestions, summary, created_at
      FROM analyses
      WHERE conversation_id = ${id}
      ORDER BY created_at ASC
    `;

    // Format the response to match the Go backend's JSON shape.
    const analyses = analysisRows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      inputType: row.input_type,
      rawText: row.raw_text,
      imageUrl: row.image_url ?? undefined,
      toneMode: row.tone_mode,
      interestScore: row.interest_score,
      subtextTranslation: row.subtext_translation,
      replySuggestions: row.reply_suggestions,
      summary: row.summary,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      id: conv.id,
      contactName: conv.contact_name,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      analyses,
    });
  } catch (err) {
    console.error("Get conversation error:", err);
    return NextResponse.json(
      { error: "failed to get conversation" },
      { status: 500 }
    );
  }
}
