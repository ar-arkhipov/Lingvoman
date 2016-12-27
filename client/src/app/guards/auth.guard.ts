import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs/observable';
import {AuthService} from "../services/auth.service";
import {AngularFire} from "angularfire2";

@Injectable()
export class AuthGuard implements CanActivate {

  constructor(private af: AngularFire, private router: Router, private auth: AuthService) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.af.auth.map((auth) =>  {
      if(auth == null) {
        this.router.navigate(['/login']);
        return false;
      } else {
        return true;
      }
    }).first()
  }
}
