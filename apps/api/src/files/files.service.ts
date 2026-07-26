import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoredFileEntity } from './entities/stored-file.entity';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(StoredFileEntity)
    private readonly storedFilesRepository: Repository<StoredFileEntity>,
  ) {}
}
