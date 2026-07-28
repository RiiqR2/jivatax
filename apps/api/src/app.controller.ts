import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/decorators/public.decorator";

@Controller()
export class AppController {
  @Get("health")
  @Public()
  health(): { status: string } {
    return { status: "ok" };
  }
}
