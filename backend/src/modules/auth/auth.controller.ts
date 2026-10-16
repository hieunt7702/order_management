import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, BootstrapOwnerDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser, CurrentTenantId, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Request } from 'express';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập người dùng bằng email và mật khẩu' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về Access Token và Refresh Token' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const deviceInfo = req.headers['user-agent'];
    return this.authService.login(loginDto, deviceInfo);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới Access Token bằng Refresh Token (Token Rotation)' })
  @ApiResponse({ status: 200, description: 'Cấp mới cặp Access & Refresh Token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất và thu hồi Refresh Token' })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại kèm Workspace/Tenant đang kích hoạt' })
  async me(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.authService.getProfile(user.id, tenantId);
  }

  @Public()
  @Post('bootstrap')
  @ApiOperation({ summary: 'Khởi tạo Workspace/Tenant mới kèm tài khoản OWNER đầu tiên' })
  async bootstrap(@Body() dto: BootstrapOwnerDto) {
    return this.authService.bootstrapOwner(dto);
  }
}
