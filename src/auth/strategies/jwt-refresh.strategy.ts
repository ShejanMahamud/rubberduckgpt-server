import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IJwtPayload } from 'src/auth/types';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(
    //inject config service
    private config: ConfigService,
  ) {
    //pass env values to parent class
    super({
      //secret key
      secretOrKey: config.get<string>('REFRESH_TOKEN_SECRET') as string,
      //extract jwt from request
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // pass request to callback
      passReqToCallback: true,
    });
  }

  //validate and return the payload
  validate(payload: IJwtPayload): IJwtPayload {
    console.log('Refresh token payload:', payload);
    return payload;
  }
}
