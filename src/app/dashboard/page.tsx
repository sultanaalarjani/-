import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import Dashboard from "./Dashboard";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <Dashboard
      me={{
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        sectorIds: user.sectorIds || [],
      }}
    />
  );
}
