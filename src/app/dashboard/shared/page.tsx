import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPublicLink } from "@/server/services/file.service";
import { listShares } from "@/server/services/file.service";
import { readStore } from "@/lib/store";
import { ShareActions } from "@/components/share-actions";

export default async function SharedLinksPage() {
  const [links, store] = await Promise.all([listShares(), readStore()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Shared Links</h1>
        <p className="mt-2 text-muted-foreground">Manage secure public links with expiry, password and download limits.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {links.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
              No share links yet. Create one from a file detail page.
            </div>
          ) : null}
          {links.map((link) => (
            <div key={link.id} className="rounded-2xl border border-border/70 p-4">
              <div className="font-medium">
                {store.files.find((file) => file.id === link.fileId)?.displayName || "Unknown file"}
              </div>
              <div className="mt-2 break-all text-sm text-muted-foreground">
                {buildPublicLink(link.token)}
              </div>
              <div className="mt-4">
                <ShareActions shareId={link.id} url={buildPublicLink(link.token)} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
