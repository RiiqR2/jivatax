import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { WorkPaperJobService } from "./work-paper-job.service";
import { TaxWorkPapersService } from "../tax-work-papers.service";

@Injectable()
export class WorkPaperJobProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkPaperJobProcessor.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(
    private readonly jobs: WorkPaperJobService,
    private readonly workPapers: TaxWorkPapersService,
  ) {}

  onModuleInit(): void {
    if (process.env.WORK_PAPER_JOBS_ENABLED === "false") return;
    if (process.env.NODE_ENV === "test") return;
    const intervalMs = Number(process.env.WORK_PAPER_JOB_POLL_MS ?? 2000);
    this.timer = setInterval(() => {
      void this.processNext();
    }, intervalMs);
    this.logger.log(
      `Work paper job processor started (poll every ${intervalMs}ms)`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async processNext(): Promise<boolean> {
    if (this.processing) return false;
    this.processing = true;
    try {
      const job = await this.jobs.claimNextPending();
      if (!job) return false;
      await this.workPapers.processCalculatorRunJob(job);
      return true;
    } catch (error) {
      this.logger.error(
        "Unexpected error while processing work paper job",
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    } finally {
      this.processing = false;
    }
  }
}
