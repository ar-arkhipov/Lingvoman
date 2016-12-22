import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { MainComponent } from './main/main.component';
import { AuthGuard } from "./guards/auth.guard";
import { TranslationsListComponent } from './translations-list/translations-list.component';

export const ROUTES: Routes = [
  { path: 'login', component: LoginComponent},
  { path: '', component: MainComponent, canActivate:[AuthGuard], children: [
    { path: 'translations', component: TranslationsListComponent}
  ]},
  { path: '**', redirectTo: '' }
];
