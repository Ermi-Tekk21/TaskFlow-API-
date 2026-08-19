import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { HashService } from '../shared/services/hash.service';
import { BruteForceService } from './services/brute-force.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

// Constant dummy hash to prevent timing attacks when an email does not exist
const DUMMY_BCRYPT_HASH =
  '$2b$10$7EqJtq98hPqEX7fNZaFWoOij8t2H09k1nFeqgN2m6d7J1P1K3eW8u';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly hashService: HashService,
    private readonly jwtService: JwtService,
    private readonly bruteForceService: BruteForceService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    const token = this.generateToken(user.id, user.email, user.role);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, failedLoginAttempts, lockedUntil, ...result } = user;
    return {
      user: result,
      accessToken: token,
    };
  }

  async login(loginDto: LoginDto, clientIp = '127.0.0.1') {
    // 1. Check if the IP is blocked due to excessive failures
    this.bruteForceService.checkIpStatus(clientIp);

    // 2. Fetch user by email
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      // Mitigate timing attacks by performing a real bcrypt comparison
      await this.hashService.comparePassword(
        loginDto.password,
        DUMMY_BCRYPT_HASH,
      );
      await this.bruteForceService.handleFailedAttempt(null, clientIp);
    }

    // 3. Check if account is temporarily locked
    await this.bruteForceService.checkAccountStatus(user);

    // 4. Verify password
    const isPasswordValid = await this.hashService.comparePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      await this.bruteForceService.handleFailedAttempt(user, clientIp);
    }

    // 5. Successful login: reset failed attempts & clear lockout
    await this.bruteForceService.handleSuccessfulLogin(user, clientIp);

    const token = this.generateToken(user.id, user.email, user.role);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, failedLoginAttempts, lockedUntil, ...result } = user;

    return {
      user: result,
      accessToken: token,
    };
  }

  private generateToken(userId: string, email: string, role: string): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }
}
