import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { OrganizationEntity } from "../../organizations/entities/organization.entity";

@Injectable()
export class AdminOrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
  ) {}

  async list() {
    const organizations = await this.organizations.find({
      where: {
        deletedAt: IsNull(),
      },
      order: {
        name: "ASC",
      },
    });

    return {
      items: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        status: organization.status,
      })),
    };
  }
}
