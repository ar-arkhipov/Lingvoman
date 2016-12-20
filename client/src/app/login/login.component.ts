import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'lm-login',
  templateUrl: './login.component.html',
  styleUrls: ["./login-component.scss"]
})

export class LoginComponent implements OnInit {
  private userData;

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.auth.login({
      username: 'admin',
      password: 'password'
    }).subscribe(
      data => console.log(data),
      err => console.log(err)
    )
  }
}
