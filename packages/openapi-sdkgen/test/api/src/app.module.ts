import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { TasksController } from './tasks.controller';
import { StreamController } from './stream.controller';
import { PrimitivesController } from './primitives.controller';
import { ParametersController } from './parameters.controller';
import { BodiesController } from './bodies.controller';
import { ResponsesController } from './responses.controller';
import { FilesController } from './files.controller';
import { PolymorphismController } from './polymorphism.controller';
import { PaginationController } from './pagination.controller';
import { EdgeCasesController } from './edge-cases.controller';

@Module({
  controllers: [
    UsersController,
    TasksController,
    StreamController,
    PrimitivesController,
    ParametersController,
    BodiesController,
    ResponsesController,
    FilesController,
    PolymorphismController,
    PaginationController,
    EdgeCasesController,
  ],
})
export class AppModule {}
