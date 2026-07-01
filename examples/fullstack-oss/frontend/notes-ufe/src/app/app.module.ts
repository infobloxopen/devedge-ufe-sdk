/**
 * Root Angular module for the Notes-ufe uFE.
 *
 * HttpClient is provided WITH the open-core functional bearerAuthInterceptor,
 * so every API call carries `Authorization: Bearer <token>` from the injected
 * SessionProvider without any per-app auth wiring.
 *
 * Angular Material is the OSS example's design system; the Material modules
 * used by the notes view (list, form fields, input, button) are imported here.
 */
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { bearerAuthInterceptor } from '@infobloxopen/devedge-ufe-angular';

import { AppComponent } from './app.component';
import { HomeComponent } from './home.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [AppComponent, HomeComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    ReactiveFormsModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    AppRoutingModule,
  ],
  providers: [provideHttpClient(withInterceptors([bearerAuthInterceptor]))],
  bootstrap: [AppComponent],
})
export class AppModule {}
