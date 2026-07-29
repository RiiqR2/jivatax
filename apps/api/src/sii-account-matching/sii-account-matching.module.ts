import { Module } from "@nestjs/common";
import { SiiAccountTermsSyncService } from "./services/sii-account-terms-sync.service";
import { AccountSuggestionService } from "./services/account-suggestion.service";

@Module({
  providers: [SiiAccountTermsSyncService, AccountSuggestionService],
  exports: [SiiAccountTermsSyncService, AccountSuggestionService],
})
export class SiiAccountMatchingModule {}
