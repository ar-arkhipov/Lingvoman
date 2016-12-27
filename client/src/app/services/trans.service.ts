import { Http, Response, Headers, RequestOptions } from '@angular/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/observable';
import 'rxjs/add/operator/map';
import { AuthService } from "./auth.service";

const API_ENDPOINT = 'http://localhost:1337/api/';

@Injectable()
export class TransService {
  private options: RequestOptions;

  constructor(private http: Http, private auth: AuthService) {

  }

  getList():any {

  }

}
