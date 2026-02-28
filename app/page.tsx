import Dashboard from "@/components/Dashboard";
import { normalizeUrl, pageUrlToAppPath } from "@/utils/url";
import { getOrCreateWebsite } from "@/utils/api.server";
import { redirect } from "next/navigation";

export function generateMetadata() {
  return { title: 'My Annotations' };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { url: rawUrl } = await searchParams;

  if (rawUrl) {
    // Backward-compat: redirect legacy ?url=... links to the new path-based scheme.
    const url = normalizeUrl(rawUrl);
    const website = await getOrCreateWebsite(url);
    redirect(pageUrlToAppPath(url, website.id));
  }

  return <Dashboard />;
}
