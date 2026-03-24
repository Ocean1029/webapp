import { NextResponse } from "next/server";
import { analyzeConversation } from "@/lib/ai";
import { getSQL } from "@/lib/db";

interface AnalyzeTextBody {
  text?: string;
  toneMode?: string;
  contactName?: string;
}

export async function POST(request: Request) {
  let body: AnalyzeTextBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 }
    );
  }

  const { text, toneMode, contactName } = body;

  // Validate required fields (same rules as Go handler).
  if (!text) {
    return NextResponse.json(
      { error: "text is required" },
      { status: 400 }
    );
  }

  if (toneMode !== "counselor" && toneMode !== "bestfriend") {
    return NextResponse.json(
      { error: "toneMode must be 'counselor' or 'bestfriend'" },
      { status: 400 }
    );
  }

  if (!contactName) {
    return NextResponse.json(
      { error: "contactName is required" },
      { status: 400 }
    );
  }

  try {
    // Analyze with Claude AI.
    const analysisResult = await analyzeConversation(text, toneMode);

    // Create conversation in the database.
    const sql = getSQL();
    const convRows = await sql`
      INSERT INTO conversations (contact_name)
      VALUES (${contactName})
      RETURNING id, contact_name, created_at, updated_at
    `;
    const conv = convRows[0];

    // Save the analysis to the database.
    const subtextJson = JSON.stringify(analysisResult.subtextTranslation);
    const replyJson = JSON.stringify(analysisResult.replySuggestions);

    const analysisRows = await sql`
      INSERT INTO analyses (
        conversation_id, input_type, raw_text, tone_mode,
        interest_score, subtext_translation, reply_suggestions, summary
      )
      VALUES (
        ${conv.id}, 'text', ${text}, ${toneMode},
        ${analysisResult.interestScore}, ${subtextJson}::jsonb,
        ${replyJson}::jsonb, ${analysisResult.summary}
      )
      RETURNING id, conversation_id, input_type, raw_text, image_url,
                tone_mode, interest_score, subtext_translation,
                reply_suggestions, summary, created_at
    `;
    const analysis = analysisRows[0];

    // Format the response to match the Go backend's JSON shape.
    return NextResponse.json({
      id: analysis.id,
      conversationId: analysis.conversation_id,
      inputType: analysis.input_type,
      rawText: analysis.raw_text,
      imageUrl: analysis.image_url ?? undefined,
      toneMode: analysis.tone_mode,
      interestScore: analysis.interest_score,
      subtextTranslation: analysis.subtext_translation,
      replySuggestions: analysis.reply_suggestions,
      summary: analysis.summary,
      createdAt: analysis.created_at,
    });
  } catch (err) {
    console.error("Analyze text error:", err);
    return NextResponse.json(
      { error: "analysis failed" },
      { status: 500 }
    );
  }
}
