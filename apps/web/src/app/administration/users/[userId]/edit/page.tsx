import { EditAdminUserPage } from "@/components/admin/users/edit-admin-user-page";

export default async function EditAdminUserRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <EditAdminUserPage userId={userId} />;
}
