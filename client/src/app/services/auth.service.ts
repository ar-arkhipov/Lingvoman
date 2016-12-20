import { Http, Response} from '@angular/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';

const ENDPOINT = 'http://localhost:1337/login';

@Injectable()
export class AuthService {
  private isLogged = false;

  constructor(private http: Http) {
    this.isLogged = !!localStorage.getItem('userData');
  }

  login(credentials) {
    return this.http
      .post(ENDPOINT, credentials)
      .map((res: Response) => res.json())
  }

  logout() {
    localStorage.removeItem('userData');
    this.isLogged = false;
  }

  isLoggedIn() {
    return this.isLogged;
  }
}
