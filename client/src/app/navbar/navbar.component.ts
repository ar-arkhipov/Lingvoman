import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

@Component({
  selector: 'lm-nav',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar-component.scss']
})

export class NavbarComponent implements OnInit {
  public name: string;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.name = this.auth.user.name;
  }
}
