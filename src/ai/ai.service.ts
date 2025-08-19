import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';

@Injectable()
export class AiService {
  constructor(@Inject('GEMINI') private readonly gemini: GoogleGenAI,
  @Inject('GROQ') private readonly groq: Groq
){

  }
  create(createAiDto: CreateAiDto) {
    return 'This action adds a new ai';
  }

  findAll() {
    return `This action returns all ai`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ai`;
  }

  update(id: number, updateAiDto: UpdateAiDto) {
    return `This action updates a #${id} ai`;
  }

  remove(id: number) {
    return `This action removes a #${id} ai`;
  }
}
