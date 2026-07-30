import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../../common/mail/mail.module';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { AuthIndexesService } from './auth-indexes.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // Cast to number to satisfy @nestjs/jwt's StringValue requirement;
          // JWT library accepts '7d'-style strings at runtime.
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ??
            '7d') as unknown as number,
        },
      }),
    }),
    // Import MailModule để AuthService có thể inject MailService
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthIndexesService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
