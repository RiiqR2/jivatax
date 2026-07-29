import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateTaxPeriodDto, UpdateTaxPeriodDto } from "../dto/accounting.dto";
import { TaxPeriodEntity } from "../entities/tax-period.entity";

@Injectable()
export class TaxPeriodsService {
  constructor(
    @InjectRepository(TaxPeriodEntity)
    private readonly periods: Repository<TaxPeriodEntity>,
  ) {}

  list(companyId: string): Promise<TaxPeriodEntity[]> {
    return this.periods.find({
      where: { companyId },
      order: { taxYear: "DESC" },
    });
  }

  async get(companyId: string, id: string): Promise<TaxPeriodEntity> {
    const period = await this.periods.findOneBy({ id, companyId });
    if (!period)
      throw new NotFoundException("Período tributario no encontrado.");
    return period;
  }

  async create(
    companyId: string,
    dto: CreateTaxPeriodDto,
  ): Promise<TaxPeriodEntity> {
    this.validate(dto);
    if (await this.periods.existsBy({ companyId, taxYear: dto.taxYear })) {
      throw new ConflictException(
        "Ya existe ese año tributario para la empresa.",
      );
    }
    return this.periods.save(
      this.periods.create({
        companyId,
        commercialYear: dto.commercialYear,
        taxYear: dto.taxYear,
        startDate: dto.startDate,
        endDate: dto.endDate,
        taxRegime: dto.taxRegime ?? null,
        currency: dto.currency ?? "CLP",
      }),
    );
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateTaxPeriodDto,
  ): Promise<TaxPeriodEntity> {
    const period = await this.get(companyId, id);
    if (dto.status !== undefined) period.status = dto.status;
    if (dto.taxRegime !== undefined) period.taxRegime = dto.taxRegime;
    if (dto.isActive !== undefined) period.isActive = dto.isActive;
    return this.periods.save(period);
  }

  private validate(dto: CreateTaxPeriodDto): void {
    const start = new Date(`${dto.startDate}T00:00:00Z`);
    const end = new Date(`${dto.endDate}T00:00:00Z`);
    if (
      !Number.isFinite(start.valueOf()) ||
      !Number.isFinite(end.valueOf()) ||
      start > end
    ) {
      throw new BadRequestException(
        "El rango de fechas del período no es válido.",
      );
    }
    if (
      start.getUTCFullYear() !== dto.commercialYear ||
      end.getUTCFullYear() !== dto.commercialYear
    ) {
      throw new BadRequestException(
        "El año comercial debe corresponder al rango de fechas.",
      );
    }
    if (
      dto.taxYear !== dto.commercialYear + 1 &&
      !dto.exceptionReason?.trim()
    ) {
      throw new BadRequestException(
        "Indica una justificación cuando el año tributario no sigue al comercial.",
      );
    }
  }
}
