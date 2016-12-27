import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';


@Component({
  selector: 'lm-signup',
  templateUrl: './signup.component.html',
  styleUrls: ["./signup-component.scss"]
})

export class SignupComponent implements OnInit {
  public signupData: any = {};
  public loading: boolean = false;

  constructor(private auth: AuthService, private router: Router) {

  }

  ngOnInit() {

  }

  signup(data) {
    this.loading = true;
    this.auth.createUser(data)
      .then(() => {
        this.loading = false;
        this.router.navigate(['/'])
      })
      .catch((error) => {
        this.loading = false;
        console.log(error);
    })
  }
}
