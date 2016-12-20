import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { AppComponent } from './app.component';

export const ROUTES: Routes = [
  { path: 'login', component: LoginComponent},
  { path: '**', component: AppComponent }
];
