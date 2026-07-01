/**
 * Root Angular module for the Notes-ufe uFE.
 *
 * HttpClient is provided WITH the open-core functional bearerAuthInterceptor,
 * so every API call carries `Authorization: Bearer <token>` from the injected
 * SessionProvider without any per-app auth wiring. The GENERATED notesd client
 * (`@example/notesd-client`) rides this SAME HttpClient, so the interceptor
 * covers the generated requests too.
 *
 * The generated client reads its API base URL from `ApiConfiguration.rootUrl`.
 * The generated package exports `provideApiConfiguration(rootUrl)`, a one-line
 * provider helper. We call it here with `environment.notesApiBaseUrl`, so the
 * whole app (and the NotesApiService facade) shares one configured client
 * instance without any hand-written factory.
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
import { provideApiConfiguration } from '@example/notesd-client';

import { AppComponent } from './app.component';
import { HomeComponent } from './home.component';
import { AppRoutingModule } from './app-routing.module';
import { environment } from '../environments/environment';

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
  providers: [
    provideHttpClient(withInterceptors([bearerAuthInterceptor])),
    provideApiConfiguration(environment.notesApiBaseUrl),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
