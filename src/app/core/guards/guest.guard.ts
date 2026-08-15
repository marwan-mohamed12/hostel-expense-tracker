import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return router.createUrlTree(['/']);
  }
  if (auth.token()) {
    const user = await auth.restoreSession();
    if (user) {
      return router.createUrlTree(['/']);
    }
  }
  return true;
};
