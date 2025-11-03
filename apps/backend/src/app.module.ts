import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskerooModule } from './taskeroo/taskeroo.module';
import { WikirooModule } from './wikiroo/wikiroo.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || 'data/database.sqlite',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
    }),
    TaskerooModule,
    WikirooModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
