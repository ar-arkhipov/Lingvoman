import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { TransService } from '../services/trans.service';

@Component({
  selector: 'lm-trans-list',
  templateUrl: './translations-list.component.html',
  styleUrls: ['./translations-list-component.scss']
})

export class TranslationsListComponent implements OnInit {
  public list: any;

  constructor(private trans: TransService, private router: Router) {}

  ngOnInit() {
    console.log('List inited');
    this.trans.getList().subscribe(data => {
        this.list = data;
      },
      error => {
        console.log(error)
      })
  }
}
