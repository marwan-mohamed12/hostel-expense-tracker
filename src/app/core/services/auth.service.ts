import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, User } from '../../models/user.model';

const TOKEN_KEY = 'hostel-expense-tracker-token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly userSignal = signal<User | null>(null);
  readonly currentUser = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.userSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  token(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  async login(username: string, password: string): Promise<User> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { username, password }),
    );
    sessionStorage.setItem(TOKEN_KEY, response.accessToken);
    this.userSignal.set(response.user);
    return response.user;
  }

  async restoreSession(): Promise<User | null> {
    if (!this.token()) {
      this.userSignal.set(null);
      return null;
    }
    try {
      const user = await firstValueFrom(this.http.get<User>(`${environment.apiUrl}/auth/me`));
      this.userSignal.set(user);
      return user;
    } catch {
      this.clearSession();
      return null;
    }
  }

  logout(): void {
    this.clearSession();
    void this.router.navigateByUrl('/login');
  }

  clearSession(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    this.userSignal.set(null);
  }
}
