import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserEntity } from "./entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    readonly usersRepository: Repository<UserEntity>,
  ) {}

  findForAuthentication(email: string): Promise<UserEntity | null> {
    return this.usersRepository
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("user.email = :email", { email: email.trim().toLowerCase() })
      .andWhere("user.deletedAt IS NULL")
      .getOne();
  }
}
