import { NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { ensureMigrated } from "@/lib/ensure-migrated";

type Params = { params: Promise<{ name: string }> };

/** GET — list all aliases for a canonical name. */
export async function GET(_req: Request, { params }: Params) {
  const { name } = await params;
  const canonical = decodeURIComponent(name);
  try {
    await ensureMigrated();
    const sql = getSQL();
    const rows = await sql`
      SELECT alias FROM contact_aliases
      WHERE LOWER(canonical_name) = LOWER(${canonical})
      ORDER BY created_at ASC
    `;
    return NextResponse.json(rows.map((r) => r.alias as string));
  } catch (err) {
    console.error("GET aliases error:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

interface AliasBody {
  action: "addAlias" | "removeAlias" | "rename" | "merge";
  alias?: string;       // for addAlias / removeAlias
  newName?: string;     // for rename
  mergeName?: string;   // for merge (mergeName becomes alias of canonical)
}

/**
 * PATCH — modify aliases or rename the canonical.
 * Actions:
 *   addAlias    { alias }    — add an existing contact name as alias
 *   removeAlias { alias }    — remove an alias (reverts to standalone)
 *   rename      { newName }  — rename the canonical display name
 *   merge       { mergeName }— make mergeName an alias of this canonical
 */
export async function PATCH(req: Request, { params }: Params) {
  const { name } = await params;
  const canonical = decodeURIComponent(name);

  let body: AliasBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    await ensureMigrated();
    const sql = getSQL();

    if (body.action === "addAlias") {
      const alias = body.alias?.trim();
      if (!alias) return NextResponse.json({ error: "alias required" }, { status: 400 });
      if (alias.toLowerCase() === canonical.toLowerCase())
        return NextResponse.json({ error: "alias cannot equal canonical" }, { status: 400 });

      await sql`
        INSERT INTO contact_aliases (canonical_name, alias)
        VALUES (${canonical}, ${alias})
        ON CONFLICT DO NOTHING
      `;
    }

    else if (body.action === "removeAlias") {
      const alias = body.alias?.trim();
      if (!alias) return NextResponse.json({ error: "alias required" }, { status: 400 });
      await sql`
        DELETE FROM contact_aliases
        WHERE LOWER(canonical_name) = LOWER(${canonical})
          AND LOWER(alias) = LOWER(${alias})
      `;
    }

    else if (body.action === "rename") {
      const newName = body.newName?.trim();
      if (!newName) return NextResponse.json({ error: "newName required" }, { status: 400 });
      // Update all rows referencing the old canonical
      await sql`
        UPDATE contact_aliases SET canonical_name = ${newName}
        WHERE LOWER(canonical_name) = LOWER(${canonical})
      `;
      // Update person_insights
      await sql`
        UPDATE person_insights SET contact_name = ${newName}
        WHERE LOWER(contact_name) = LOWER(${canonical})
      `;
    }

    else if (body.action === "merge") {
      const mergeName = body.mergeName?.trim();
      if (!mergeName) return NextResponse.json({ error: "mergeName required" }, { status: 400 });
      // mergeName becomes an alias of canonical
      // First, migrate any existing aliases of mergeName to canonical
      await sql`
        UPDATE contact_aliases SET canonical_name = ${canonical}
        WHERE LOWER(canonical_name) = LOWER(${mergeName})
      `;
      // Insert mergeName itself as an alias
      await sql`
        INSERT INTO contact_aliases (canonical_name, alias)
        VALUES (${canonical}, ${mergeName})
        ON CONFLICT DO NOTHING
      `;
      // Remove the now-redundant person_insights for mergeName
      await sql`
        DELETE FROM person_insights WHERE LOWER(contact_name) = LOWER(${mergeName})
      `;
    }

    else {
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH aliases error:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
