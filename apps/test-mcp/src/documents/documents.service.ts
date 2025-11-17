import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentsService {

  async listDocuments(): Promise<string[]> {
    return [
      "How to cook humans",
      "How to cook for humans",
      "How to cook forty humans",
      "How to cook for forty humans",
    ]
  }
}
