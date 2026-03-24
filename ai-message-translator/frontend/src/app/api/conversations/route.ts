import { NextResponse } from "next/server";
import { getSQL } from "@/lib/db";

export async function GET() {
  try {
    const sql = getSQL();
    const rows = await sql`
      SELECT id, contact_name, created_at, updated_at
      FROM conversations
      ORDER BY updated_at DESC
    `;

    // Format rows to match the Go backend's camelCase JSON shape.
    const conversations = rows.map((row) => ({
      id: row.id,
      contactName: row.contact_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(conversations);
  } catch (err) {
    console.error("List conversations error:", err);
    return NextResponse.json(
      { error: "failed to list conversations" },
      { status: 500 }
    );
  }
}
