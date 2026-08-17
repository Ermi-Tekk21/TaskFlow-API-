import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { AuthThrottle } from '../common/decorators/throttle.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @AuthThrottle(5, 60000) // 5 registrations per minute per IP
  async register(@Body() createUserDto: CreateUserDto) {
    return await this.authService.register(createUserDto);
  }

  @Post('login')
  @AuthThrottle(5, 60000) // 5 login requests per minute per IP
  async login(@Body() loginDto: LoginDto, @ClientIp() ip: string) {
    return await this.authService.login(loginDto, ip);
  }
}
