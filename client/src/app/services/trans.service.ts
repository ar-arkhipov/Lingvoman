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
    let token = auth.token || '';
    let headers = new Headers();
    headers.append('x-access-token', token);
    this.options = new RequestOptions({headers: headers});
  }

  getList(): Observable<Response> {
    let url: string = API_ENDPOINT + 'uitranslate/list';
    return this.http.get(url, this.options).map((res) => res.json());
  }

}
