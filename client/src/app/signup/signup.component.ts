import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';


@Component({
  selector: 'lm-signin',
  templateUrl: './signup.component.html',
  styleUrls: ["./signup-component.scss"]
})

export class SignupComponent implements OnInit {
  public signinData: any = {};
  public loading: boolean = false;

  constructor(private auth: AuthService, private router: Router) {

  }

  ngOnInit() {

  }

  login(data) {
    this.loading = true;
    console.log(data);
  }
}
