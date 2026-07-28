import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import {
  DownloadUrlResponseDto,
  FileResponseDto,
  UploadUrlResponseDto,
} from './dto/file-response.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { FilesService } from './files.service';

@Controller('companies/:companyId/files')
@UseGuards(CompanyAccessGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  createUploadUrl(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateUploadUrlDto,
  ): Promise<UploadUrlResponseDto> {
    return this.filesService.createUploadUrl(companyId, dto);
  }

  @Post('complete')
  completeUpload(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CompleteUploadDto,
  ): Promise<FileResponseDto> {
    return this.filesService.completeUpload(companyId, dto);
  }

  @Get()
  list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListFilesQueryDto,
  ): Promise<FileResponseDto[]> {
    return this.filesService.list(companyId, query);
  }

  @Get(':fileId/download-url')
  createDownloadUrl(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<DownloadUrlResponseDto> {
    return this.filesService.createDownloadUrl(companyId, fileId);
  }
}
