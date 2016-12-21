import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';


@Component({
  selector: 'lm-login',
  templateUrl: './login.component.html',
  styleUrls: ["./login-component.scss"]
})

export class LoginComponent implements OnInit {
  public credentials: any = {};
  public loading: boolean = false;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {

  }

  login() {
    this.loading = true;
    this.auth.login(this.credentials).subscribe(result => {
      this.loading = false;
      this.router.navigate(['/']);
    }, error => {
      this.loading = false;
      console.log(error); //So and what @TODO with that here???
    });
  }
}
