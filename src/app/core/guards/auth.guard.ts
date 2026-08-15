import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { HostelStore } from '../services/hostel.store';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const store = inject(HostelStore);
  const router = inject(Router);

  let loggedIn = auth.isLoggedIn();
  if (!loggedIn && auth.token()) {
    loggedIn = (await auth.restoreSession()) !== null;
  }
  if (!loggedIn) {
    return router.createUrlTree(['/login']);
  }
  if (!store.loaded()) {
    try {
      await store.loadFromApi();
    } catch {
      // Pages show loadError; stay on the route so the user can retry after login.
    }
  }
  return true;
};
