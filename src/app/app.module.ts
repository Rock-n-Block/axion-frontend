import { BrowserModule } from "@angular/platform-browser";
import { APP_INITIALIZER, NgModule, Injector } from "@angular/core";
import { ClipboardModule } from "ngx-clipboard";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { ClaimPageComponent } from "./claim-page/claim-page.component";
import { AuctionPageComponent } from "./auction-page/auction-page.component";
import { TransactionSuccessModalComponent } from "./components/transactionSuccessModal/transaction-success-modal.component";
import { MetamaskErrorComponent } from "./components/metamaskError/metamask-error.component";
import { ContractService } from "./services/contract";
import { FormsModule } from "@angular/forms";
import {
  BigNumberDirective,
  BigNumberFormat,
  BigNumberMax,
  BigNumberMin,
} from "./directives/bignumber/bignumber";
import { StakingPageComponent } from "./staking-page/staking-page.component";
import { MinMaxDirective } from "./directives/minmax/minmax";
import { AngularFittextModule } from "angular-fittext";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HttpClientModule } from "@angular/common/http";
import { MatDialogModule, MatTooltipModule } from "@angular/material";

export function initializeApp(injector: Injector) {
  return () =>
    new Promise<any>((resolve: any) => {
      const contractService = injector.get(
        ContractService,
        Promise.resolve(null)
      );
      contractService.getStaticInfo().then(() => {
        resolve(null);
      });
    });
}

@NgModule({
  entryComponents: [TransactionSuccessModalComponent, MetamaskErrorComponent],
  declarations: [
    AppComponent,
    ClaimPageComponent,
    AuctionPageComponent,
    TransactionSuccessModalComponent,
    MetamaskErrorComponent,
    BigNumberDirective,
    BigNumberFormat,
    BigNumberMin,
    BigNumberMax,
    StakingPageComponent,
    MinMaxDirective,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MatDialogModule,
    MatTooltipModule,
    FormsModule,
    AngularFittextModule,
    HttpClientModule,
    BrowserAnimationsModule,
    ClipboardModule,
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [Injector],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
