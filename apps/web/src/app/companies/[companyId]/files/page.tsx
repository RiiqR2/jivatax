import { FilesPage } from "../../../../../components/files/files-page";

export default async function CompanyFilesRoute({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return <FilesPage companyId={companyId} />;
}
