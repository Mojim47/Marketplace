/**
 * AI Search Controller - REST API for AI-powered search
 * Enterprise Scalability Architecture
 * Requirements: 4.1, 4.2, 4.5, 4.7
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { AISearchResult, AISearchService } from './ai-search.service';

/** Search request DTO */
class SearchRequestDto {
  query!: string;
  sessionId?: string;
  useCache?: boolean;
  topics?: string[];
}

/** Prediction request DTO */
class PredictionRequestDto {
  partialQuery!: string;
  sessionId!: string;
}

/** Streaming chunk DTO */
class StreamingChunkDto {
  sessionId!: string;
  content!: string;
  isComplete!: boolean;
}

/** Finalize prediction DTO */
class FinalizePredictionDto {
  sessionId!: string;
  finalQuery!: string;
}

@Controller('api/ai-search')
export class AISearchController {
  constructor(private readonly aiSearchService: AISearchService) {}

  /**
   * Search with semantic caching
   * GET /api/ai-search?query=...
   */
  @Get()
  async search(
    @Query('query') query: string,
    @Query('useCache') useCache?: string
  ): Promise<AISearchResult> {
    return this.aiSearchService.search({
      query,
      useCache: useCache !== 'false',
    });
  }

  /**
   * Search with full options
   * POST /api/ai-search
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async searchPost(@Body() dto: SearchRequestDto): Promise<AISearchResult> {
    return this.aiSearchService.search(dto);
  }

  /**
   * Start streaming prediction
   * POST /api/ai-search/predictions/start
   */
  @Post('predictions/start')
  @HttpCode(HttpStatus.OK)
  async startPrediction(@Body() dto: PredictionRequestDto) {
    return this.aiSearchService.startPrediction(dto.partialQuery, dto.sessionId);
  }

  /**
   * Update prediction with streaming chunk
   * POST /api/ai-search/predictions/update
   */
  @Post('predictions/update')
  @HttpCode(HttpStatus.OK)
  async updatePrediction(@Body() dto: StreamingChunkDto) {
    await this.aiSearchService.updatePrediction(dto.sessionId, {
      sessionId: dto.sessionId,
      content: dto.content,
      isComplete: dto.isComplete,
      timestamp: Date.now(),
    });
    return { success: true };
  }

  /**
   * Finalize prediction
   * POST /api/ai-search/predictions/finalize
   */
  @Post('predictions/finalize')
  @HttpCode(HttpStatus.OK)
  async finalizePrediction(@Body() dto: FinalizePredictionDto) {
    return this.aiSearchService.finalizePrediction(dto.sessionId, dto.finalQuery);
  }

  /**
   * Get prediction state
   * GET /api/ai-search/predictions/:sessionId
   */
  @Get('predictions/:sessionId')
  async getPredictionState(@Param('sessionId') sessionId: string) {
    return this.aiSearchService.getPredictionState(sessionId);
  }

  /**
   * Cancel prediction
   * DELETE /api/ai-search/predictions/:sessionId
   */
  @Delete('predictions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelPrediction(@Param('sessionId') sessionId: string) {
    await this.aiSearchService.cancelPrediction(sessionId);
  }

  /**
   * Invalidate cache by topic
   * DELETE /api/ai-search/cache/topic/:topic
   */
  @Delete('cache/topic/:topic')
  async invalidateByTopic(@Param('topic') topic: string) {
    const count = await this.aiSearchService.invalidateByTopic(topic);
    return { invalidatedCount: count };
  }

  /**
   * Get cache statistics
   * GET /api/ai-search/cache/stats
   */
  @Get('cache/stats')
  async getCacheStats() {
    return this.aiSearchService.getCacheStats();
  }

  /**
   * Calculate similarity between two queries
   * GET /api/ai-search/similarity?query1=...&query2=...
   */
  @Get('similarity')
  async calculateSimilarity(@Query('query1') query1: string, @Query('query2') query2: string) {
    const similarity = await this.aiSearchService.calculateSimilarity(query1, query2);
    return { query1, query2, similarity };
  }

  /**
   * Health check
   * GET /api/ai-search/health
   */
  @Get('health')
  async healthCheck() {
    return {
      healthy: this.aiSearchService.isHealthy(),
      timestamp: new Date().toISOString(),
    };
  }
}
