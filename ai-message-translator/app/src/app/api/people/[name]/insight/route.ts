import { NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { ensureMigrated } from "@/lib/ensure-migrated";
import { generatePersonInsight } from "@/lib/ai";

const LAMBDA = 0.05;
const MS_PER_DAY = 86400000;

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const contactName = decodeURIComponent(name);

  try {
    await ensureMigrated();
    const sql = getSQL();

    const rows = await sql`
      SELECT a.interest_score, a.summary, a.created_at
      FROM analyses a
      JOIN conversations c ON c.id = a.conversation_id
      WHERE LOWER(c.contact_name) = LOWER(${contactName})
      ORDER BY a.created_at ASC
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "no analyses found" }, { status: 404 });
    }

    const now = Date.now();

    // Compute decay weights (λ = 0.05/day, newer = higher weight)
    const weighted = rows.map((row) => {
      const createdAt = new Date(row.created_at as string | Date).toISOString();
      const daysAgo = (now - new Date(createdAt).getTime()) / MS_PER_DAY;
      return {
        summary: row.summary as string,
        interestScore: row.interest_score as number,
        createdAt,
        weight: Math.exp(-LAMBDA * daysAgo),
      };
    });

    // Weighted interest score
    const weightSum = weighted.reduce((s, a) => s + a.weight, 0);
    const scoreSum = weighted.reduce((s, a) => s + a.interestScore * a.weight, 0);
    const weightedScore = Math.round((scoreSum / weightSum) * 10) / 10;

    // Generate insight with Claude
    const result = await generatePersonInsight(contactName, weighted);

    // Upsert person_insights
    await sql`
      INSERT INTO person_insights (contact_name, weighted_interest_score, overall_analysis, strategy, updated_at)
      VALUES (${contactName}, ${weightedScore}, ${result.overallAnalysis}, ${result.strategy}, NOW())
      ON CONFLICT (contact_name)
      DO UPDATE SET
        weighted_interest_score = EXCLUDED.weighted_interest_score,
        overall_analysis = EXCLUDED.overall_analysis,
        strategy = EXCLUDED.strategy,
        updated_at = NOW()
    `;

    return NextResponse.json({
      overallAnalysis: result.overallAnalysis,
      strategy: result.strategy,
      weightedInterestScore: weightedScore,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("PUT /api/people/[name]/insight error:", err);
    return NextResponse.json({ error: "failed to generate insight" }, { status: 500 });
  }
}
