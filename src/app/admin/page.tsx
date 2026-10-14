import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, revokeAdminSession } from "@/lib/admin/auth";
import AdminClient from "./admin-client";

export const runtime = "nodejs";

export default async function AdminPage() {
  const cookieStore = await cookies();
  await revokeAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  return <AdminClient />;
}
