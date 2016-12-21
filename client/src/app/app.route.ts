import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { MainComponent } from './main/main.component';
import { AuthGuard } from "./guards/auth.guard";

export const ROUTES: Routes = [
  { path: 'login', component: LoginComponent},
  { path: '', component: MainComponent, canActivate:[AuthGuard]},
  { path: '**', redirectTo: '' }
];
