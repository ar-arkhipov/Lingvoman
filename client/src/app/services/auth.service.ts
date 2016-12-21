import { Http, Response } from '@angular/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map';

const ENDPOINT = 'http://localhost:1337/login';

@Injectable()
export class AuthService {
  private isLogged: boolean = false;
  public token: string;

  constructor(private http: Http) {
    let userData = JSON.parse(localStorage.getItem('userData'));
    this.isLogged = !!userData;
    this.token = userData && userData.token;
  }

  login(credentials: any): Observable<boolean> {
    return this.http
      .post(ENDPOINT, credentials)
      .map((res: Response) => {
        let userData = res.json();
        this.token = res.json().token;
        this.isLogged = true;
        localStorage.setItem('userData', JSON.stringify(userData));
        return true;
      })
  }

  logout() {
    localStorage.removeItem('userData');
    this.isLogged = false;
  }

  isLoggedIn() {
    return this.isLogged;
  }
}
