import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
const jwt = require('jsonwebtoken');

@Injectable()
export class TelegramElfGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const bearerHeaderIndex = request.rawHeaders.indexOf('Authorization');
    const bearerValue = request.rawHeaders[bearerHeaderIndex + 1].split(' ')[1];

    try {
      const user = jwt.verify(bearerValue, process.env.JWT_SECRET);

      if (user.role === 'elf') {
        return true;
      }
    } catch (err) {
      console.log(err);
    }

    return false;
  }
}
