import { AdminShell } from '../../../../components/admin/admin-shell';
import { FilesPage } from '../../../../components/files/files-page';

export default async function CompanyFilesRoute({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return <AdminShell><FilesPage companyId={companyId} /></AdminShell>;
}
