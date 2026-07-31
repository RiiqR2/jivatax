import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";

@Injectable()
export class NormalizationService {
  normalizeIndustry(value: string): string {
    return this.normalize(value);
  }

  normalizeAccountName(value: string): string {
    return this.normalize(value);
  }

  hash(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }
}
