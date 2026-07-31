import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { CompanyEntity } from "../../companies/entities/company.entity";

@Entity({ name: "industries" })
@Index("uq_industries_normalized_name", ["normalizedName"], { unique: true })
export class IndustryEntity extends BaseEntity {
  @Column({ type: "varchar", length: 255 }) name!: string;
  @Column({ name: "normalized_name", type: "varchar", length: 255 })
  normalizedName!: string;
  @Column({ name: "created_by_user_id", type: "char", length: 36 })
  createdByUserId!: string;
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;
  @OneToMany(() => CompanyEntity, (company) => company.industry)
  companies!: CompanyEntity[];
}
