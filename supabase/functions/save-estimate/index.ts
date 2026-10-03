import { submissionRecord } from "../_shared/intake.ts";
import { corsHeaders, methodResponse, readJson, consumeBudget, serverClient, responseError } from "../_shared/security.ts";

Deno.serve(async req => {
  const early = methodResponse(req); if (early) return early;
  let photoPath: string | null = null;
  let client: ReturnType<typeof serverClient> | undefined;
  try {
    client = serverClient();
    const body = await readJson(req, 12 * 1024 * 1024);
    const { record, photo } = submissionRecord(body);
    await consumeBudget(client, "save-estimate");
    if (photo) {
      photoPath = `intake/${crypto.randomUUID()}.${photo.ext}`;
      const upload = await client.storage.from("tree-photos").upload(photoPath, photo.bytes,
        { contentType: photo.type, upsert: false });
      if (upload.error) throw new Error("Upload failed");
      record.photo_url = photoPath; // private object path, never a public or signed URL
    }
    const result = await client.from("estimates").insert(record).select("id").single();
    if (result.error) throw new Error("Save failed");
    return new Response(JSON.stringify({ id: result.data.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    if (photoPath && client) {
      try { await client.storage.from("tree-photos").remove([photoPath]); } catch { /* best-effort orphan cleanup */ }
    }
    return responseError(err);
  }
});
