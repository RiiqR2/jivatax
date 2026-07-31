import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NormalizationService } from "../common/services/normalization.service";
import { CreateIndustryDto, ListIndustriesQueryDto } from "./dto/industry.dto";
import { IndustryEntity } from "./entities/industry.entity";

@Injectable()
export class IndustriesService {
  constructor(
    @InjectRepository(IndustryEntity)
    private readonly industries: Repository<IndustryEntity>,
    private readonly normalization: NormalizationService,
  ) {}

  async list(query: ListIndustriesQueryDto) {
    const builder = this.industries
      .createQueryBuilder("industry")
      .leftJoin("industry.companies", "company", "company.deletedAt IS NULL")
      .where("industry.isActive = :active", { active: true })
      .andWhere("industry.deletedAt IS NULL");
    if (query.q?.trim()) {
      builder.andWhere("industry.normalizedName LIKE :q", {
        q: `%${this.normalization.normalizeIndustry(query.q)}%`,
      });
    }
    const rows = await builder
      .select(["industry.id", "industry.name", "industry.normalizedName"])
      .addSelect("COUNT(company.id)", "companyCount")
      .groupBy("industry.id")
      .addGroupBy("industry.name")
      .addGroupBy("industry.normalizedName")
      .orderBy("companyCount", "DESC")
      .addOrderBy("industry.name", "ASC")
      .limit(query.limit ?? 4)
      .getRawMany();
    return rows.map((row) => ({
      id: row.industry_id,
      name: row.industry_name,
      normalizedName: row.industry_normalized_name,
    }));
  }

  async create(dto: CreateIndustryDto, userId: string) {
    const normalizedName = this.normalization.normalizeIndustry(dto.name);
    if (await this.industries.existsBy({ normalizedName }))
      throw new ConflictException("El rubro ya existe.");
    try {
      const industry = await this.industries.save(
        this.industries.create({
          name: dto.name.trim(),
          normalizedName,
          createdByUserId: userId,
          isActive: true,
        }),
      );
      return {
        id: industry.id,
        name: industry.name,
        normalizedName: industry.normalizedName,
      };
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new ConflictException("El rubro ya existe.");
      throw error;
    }
  }

  async requireActive(id: string): Promise<IndustryEntity> {
    const industry = await this.industries.findOneBy({ id, isActive: true });
    if (!industry) throw new NotFoundException("Rubro activo no encontrado.");
    return industry;
  }
}
