import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { RouterModule } from "@angular/router";

import { CustomFormsModule } from 'ng2-validation';
import { MaterializeModule } from 'angular2-materialize';
import { AngularFireModule, AuthProviders, AuthMethods} from 'angularfire2';

import { ROUTES } from "./app.route";
import { AuthGuard } from "./guards/auth.guard";

import { AppComponent } from './app.component';
import { LoginComponent } from "./login/login.component";
import { SignupComponent } from './signup/signup.component';
import { MainComponent } from "./main/main.component";
import { NavbarComponent } from "./navbar/navbar.component";
import { TranslationsListComponent } from "./translations-list/translations-list.component";

import { AuthService } from "./services/auth.service";
import { TransService } from "./services/trans.service";

// Must export the config
export const firebaseConfig = {
  apiKey: "AIzaSyBGP7EnSy9ktISts4xIuBcZsK5x4jyhFP8",
  authDomain: "lingvo-b3624.firebaseapp.com",
  databaseURL: "https://lingvo-b3624.firebaseio.com",
  storageBucket: "lingvo-b3624.appspot.com"
};

export const firebaseAuthConfig = {
  provider: AuthProviders.Password,
  method: AuthMethods.Password
};

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    SignupComponent,
    MainComponent,
    NavbarComponent,
    TranslationsListComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    CustomFormsModule,
    ReactiveFormsModule,
    HttpModule,
    RouterModule.forRoot(ROUTES),
    MaterializeModule,
    AngularFireModule.initializeApp(firebaseConfig, firebaseAuthConfig)
  ],
  providers: [
    AuthService,
    AuthGuard,
    TransService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
