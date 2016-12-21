import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'lm-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main-component.scss']
})

export class MainComponent implements OnInit {

  constructor(private router: Router) {}

  ngOnInit() {}
}
