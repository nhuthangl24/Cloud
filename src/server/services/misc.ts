import { env } from "@/lib/env";

export function buildPublicLink(token: string) {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/share/${token}`;
}

export function noop() {
  return undefined;
}
