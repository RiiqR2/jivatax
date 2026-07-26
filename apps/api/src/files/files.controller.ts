import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  createUploadUrl(@Body() dto: CreateUploadUrlDto) {
    return this.filesService.createUploadUrl(dto);
  }

  @Post('register')
  registerUploadedFile(
    @Body()
    body: {
      objectKey: string;
      originalName: string;
      contentType: string;
      sizeBytes: number;
      companyId?: string;
    },
  ) {
    return this.filesService.registerUploadedFile(body);
  }

  @Get(':id/download-url')
  createDownloadUrl(@Param('id') id: string) {
    return this.filesService.createDownloadUrl(id);
  }
}
