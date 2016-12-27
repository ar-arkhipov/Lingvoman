import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { AngularFire } from 'angularfire2';
import { FirebaseRef } from 'angularfire2';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/first';


@Injectable()
export class AuthService {

  constructor(private af: AngularFire) {

  }

  createUser(signupData) {
    return this.af.auth.createUser({
      email: signupData.email,
      password: signupData.password
    }).then((success) => {
      this.af.database.object('/users/'+success.uid)
        .set({
          firstname: signupData.firstname,
          lastname: signupData.lastname,
          email: signupData.email
        });
    });
  }

  login(credentials: any) {
    return this.af.auth.login(credentials).then((success) => {

    });
  }

  logout() {
    return this.af.auth.logout();
  }

}
