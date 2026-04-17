import { createHash } from "node:crypto";

export async function sha256FromBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
