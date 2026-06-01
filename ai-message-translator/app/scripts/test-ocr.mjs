import nextEnv from "@next/env";
import { ImageAnnotatorClient } from "@google-cloud/vision";

nextEnv.loadEnvConfig(process.cwd());

const raw = process.env.GOOGLE_CREDENTIALS_JSON;
console.log("=== Env var diagnostics ===");
console.log("Defined?", !!raw);
console.log("Length:", raw?.length);
console.log("First 50 chars:", JSON.stringify(raw?.slice(0, 50)));
console.log("Last 50 chars:", JSON.stringify(raw?.slice(-50)));

let creds;
try {
  creds = JSON.parse(raw);
  console.log("\n=== JSON parse OK ===");
  console.log("Has type:", creds.type);
  console.log("Has client_email:", creds.client_email);
  console.log("Has private_key:", !!creds.private_key);
  console.log("private_key length:", creds.private_key?.length);
  console.log("private_key starts with:", JSON.stringify(creds.private_key?.slice(0, 40)));
  console.log("private_key contains real newline:", creds.private_key?.includes("\n"));
  console.log("private_key contains literal backslash-n:", creds.private_key?.includes("\\n"));
} catch (err) {
  console.error("JSON parse FAILED:", err.message);
  process.exit(1);
}

console.log("\n=== Trying Vision API call ===");
try {
  const client = new ImageAnnotatorClient({ credentials: creds });
  // 1x1 transparent PNG
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );
  const [result] = await client.textDetection({ image: { content: tinyPng } });
  console.log("Vision API responded. Annotations:", result.textAnnotations?.length ?? 0);
} catch (err) {
  console.error("Vision API call FAILED:");
  console.error("  message:", err.message);
  console.error("  code:", err.code);
  console.error("  stack:", err.stack?.split("\n").slice(0, 3).join("\n"));
}
