import { IsString, IsEthereumAddress, IsOptional, IsInt, Min } from 'class-validator';

export class GetMemoriesParamsDto {
  @IsString()
  @IsEthereumAddress()
  userId!: string;
}

export class DeleteMemoryParamsDto {
  @IsString()
  memoryId!: string;
}

export class SearchMemoriesDto {
  @IsString()
  @IsEthereumAddress()
  userId!: string;

  @IsString()
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 5;
}

export interface Memory {
  id: string;
  text: string;
  metadata?: any;
  score?: number;
  created_at: string;
  updated_at: string;
}