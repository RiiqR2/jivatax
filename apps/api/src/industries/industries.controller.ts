import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { MetaUser } from "../admin/decorators/meta-user.decorator";
import { CreateIndustryDto, ListIndustriesQueryDto } from "./dto/industry.dto";
import { IndustriesService } from "./industries.service";

@Controller("industries")
export class IndustriesController {
  constructor(private readonly industries: IndustriesService) {}
  @Get() list(@Query() query: ListIndustriesQueryDto) {
    return this.industries.list(query);
  }
  @MetaUser() @Post() create(
    @Body() dto: CreateIndustryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.industries.create(dto, user.id);
  }
}
