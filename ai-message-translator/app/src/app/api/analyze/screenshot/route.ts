import { NextResponse } from "next/server";
import { analyzeConversation } from "@/lib/ai";
import { extractTextFromImage } from "@/lib/ocr";
import { getSQL } from "@/lib/db";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid multipart form data" },
      { status: 400 }
    );
  }

  const file = formData.get("screenshot");
  const toneMode = formData.get("toneMode") as string | null;
  const contactName = formData.get("contactName") as string | null;

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "screenshot file is required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "screenshot must be JPEG, PNG, GIF, or WebP" },
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
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Step 1: Extract text from the screenshot via Google Cloud Vision.
    const extractedText = await extractTextFromImage(imageBuffer);
    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "no text detected in the screenshot" },
        { status: 422 }
      );
    }

    // Step 2: Send the extracted text to Claude for analysis.
    const analysisResult = await analyzeConversation(extractedText, toneMode);

    const sql = getSQL();
    const convRows = await sql`
      INSERT INTO conversations (contact_name)
      VALUES (${contactName})
      RETURNING id, contact_name, created_at, updated_at
    `;
    const conv = convRows[0];

    const subtextJson = JSON.stringify(analysisResult.subtextTranslation);
    const replyJson = JSON.stringify(analysisResult.replySuggestions);

    const analysisRows = await sql`
      INSERT INTO analyses (
        conversation_id, input_type, raw_text, tone_mode,
        interest_score, subtext_translation, reply_suggestions, summary
      )
      VALUES (
        ${conv.id}, 'screenshot', ${extractedText}, ${toneMode},
        ${analysisResult.interestScore}, ${subtextJson}::jsonb,
        ${replyJson}::jsonb, ${analysisResult.summary}
      )
      RETURNING id, conversation_id, input_type, raw_text, image_url,
                tone_mode, interest_score, subtext_translation,
                reply_suggestions, summary, created_at
    `;
    const analysis = analysisRows[0];

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
    console.error("Analyze screenshot error:", err);
    return NextResponse.json(
      { error: "screenshot analysis failed" },
      { status: 500 }
    );
  }
}
