import { Body, Controller, Get, Global, Headers, HttpCode, Module, Post, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IsString, MinLength } from 'class-validator';
import { AuthService, Usuario } from './auth.service';
import { GuardSeguridad, Publico, UsuarioActual } from './seguridad';

class LoginDto {
  @IsString() @MinLength(3) usuario!: string;
  @IsString() @MinLength(6) clave!: string;
}

@Controller('auth')
class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    const sesion = this.auth.iniciarSesion(dto.usuario, dto.clave);
    if (!sesion) throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    return sesion;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Headers('authorization') cabecera = ''): void {
    this.auth.cerrarSesion(cabecera.replace('Bearer ', ''));
  }

  @Get('yo')
  yo(@UsuarioActual() usuario: Usuario): Usuario {
    return usuario;
  }
}

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: GuardSeguridad }],
  exports: [AuthService],
})
export class AuthModule {}
