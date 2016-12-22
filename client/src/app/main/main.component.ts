import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TransService } from "../services/trans.service";

@Component({
  selector: 'lm-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main-component.scss']
})

export class MainComponent implements OnInit {

  constructor(private router: Router, private trans: TransService) {}

  ngOnInit() {}
}
