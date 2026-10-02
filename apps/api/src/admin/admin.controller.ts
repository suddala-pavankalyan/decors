import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MAX_IMAGE_BYTES } from '../uploads/image-storage';
import { AdminListQueryDto, ProductInputDto, ReorderDto, UploadAltDto } from './admin.dto';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get() list(@Query() query: AdminListQueryDto) { return this.admin.list(query); }
  @Get(':id') get(@Param('id') id: string) { return this.admin.get(id); }
  @Post() create(@Body() dto: ProductInputDto) { return this.admin.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: ProductInputDto) { return this.admin.update(id, dto); }

  @Delete(':id') @HttpCode(204)
  async remove(@Param('id') id: string) { await this.admin.remove(id); }

  @Post(':id/images') @HttpCode(201) @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  addImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: UploadAltDto) {
    return this.admin.addImage(id, file, body.alt);
  }

  @Put(':id/images/order')
  reorder(@Param('id') id: string, @Body() dto: ReorderDto) { return this.admin.reorderImages(id, dto.ids); }

  @Delete(':id/images/:imageId')
  removeImage(@Param('id') id: string, @Param('imageId', ParseIntPipe) imageId: number) {
    return this.admin.removeImage(id, imageId);
  }
}
