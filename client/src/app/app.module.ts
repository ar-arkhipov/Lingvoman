import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { RouterModule } from "@angular/router";

import { MaterializeModule } from 'angular2-materialize';

import { ROUTES } from "./app.route";
import { AuthGuard } from "./guards/auth.guard";

import { AppComponent } from './app.component';
import { LoginComponent } from "./login/login.component";
import { MainComponent } from "./main/main.component";
import { NavbarComponent } from "./navbar/navbar.component";
import { TranslationsListComponent } from "./translations-list/translations-list.component";

import { AuthService } from "./services/auth.service";
import { TransService } from "./services/trans.service";

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    MainComponent,
    NavbarComponent,
    TranslationsListComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    RouterModule.forRoot(ROUTES),
    MaterializeModule
  ],
  providers: [
    AuthService,
    AuthGuard,
    TransService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
