export type CompanyStatus = 'active' | 'inactive';
export interface Company { id: string; legalName: string; tradeName: string | null; taxId: string; status: CompanyStatus; createdAt: string; updatedAt: string }
export interface CompanyFilters { search?: string; status?: CompanyStatus }
export interface CompanyListResponse { items: Company[]; total: number }
export interface CompanyInput { legalName: string; tradeName?: string | null; taxId: string; status?: CompanyStatus }
