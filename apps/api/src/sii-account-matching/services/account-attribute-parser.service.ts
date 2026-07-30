import { Injectable } from "@nestjs/common";
import { accountingMetadata } from "../metadata/accounting-metadata";

@Injectable()
export class AccountAttributeParserService {
  parse(name: string) {
    return accountingMetadata(name);
  }
}
