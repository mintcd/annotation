import Dashboard from "@/components/Dashboard";

export function generateMetadata() {
  return { title: 'My Annotations' };
}

export default async function Page() {
  return <Dashboard />;
}
