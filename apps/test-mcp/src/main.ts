import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SELF_PORT, SELF_VERSION } from './config/self.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Documents server')
    .setDescription('can handle documents')
    .setVersion(SELF_VERSION)
    .addTag('mcp')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  
  await app.listen(SELF_PORT);
  console.log(`Application is running on: http://localhost:${SELF_PORT}`);
}
bootstrap();
