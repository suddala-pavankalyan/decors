import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ImageStorage } from '../uploads/image-storage';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, ImageStorage],
})
export class AdminModule {}
