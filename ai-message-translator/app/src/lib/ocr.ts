import { ImageAnnotatorClient } from "@google-cloud/vision";

let _client: ImageAnnotatorClient | null = null;

function getClient(): ImageAnnotatorClient {
  if (_client) return _client;

  const credsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!credsJson) {
    throw new Error("GOOGLE_CREDENTIALS_JSON environment variable is not set");
  }

  const credentials = JSON.parse(credsJson);
  // Use REST fallback instead of gRPC: gRPC's native bindings conflict with
  // Next.js's Turbopack dev runtime and with serverless cold-starts on Vercel.
  _client = new ImageAnnotatorClient({ credentials, fallback: true });
  return _client;
}

/**
 * Extract text from an image using Google Cloud Vision's TEXT_DETECTION.
 * Returns the full detected text, or an empty string if nothing was detected.
 */
export async function extractTextFromImage(imageData: Buffer): Promise<string> {
  const client = getClient();
  const [result] = await client.textDetection({
    image: { content: imageData },
  });

  const annotations = result.textAnnotations ?? [];
  if (annotations.length === 0) return "";

  // The first annotation contains the full detected text.
  return annotations[0].description ?? "";
}
