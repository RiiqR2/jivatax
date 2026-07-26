import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoredFileEntity } from './entities/stored-file.entity';
import { FilesService } from './files.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoredFileEntity])],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
