import {
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import BigNumber from "bignumber.js";
import { AppComponent } from "../app.component";
import { ContractService } from "../services/contract";

@Component({
  selector: "app-claim-page",
  templateUrl: "./claim-page.component.html",
  styleUrls: ["./claim-page.component.scss"],
})
export class ClaimPageComponent implements OnDestroy {
  public account;
  public tokensDecimals;
  private accountSubscribe;
  public formsData: {
    swapAmount?: string;
  } = {};
  public swapContractBalance = {
    value: 0,
    fullValue: 0,
  };
  public onChangeAccount: EventEmitter<any> = new EventEmitter();
  public swapTokensProgress: boolean;
  public updateSwapBalanceProgress: boolean;
  public withdrawH2TProgress: boolean;
  public burnTokensProgress: boolean;
  public claimTokensProgress: boolean;

  public AxnTokenAddress = "none";
  public tonkenUrl = "none";

  public dataSendForm = false;

  public clacPenalty = 0;
  public toSwap = new BigNumber(0);
  public claimDataInfo = {
    claimedAddresses: 0,
    totalAddresses: 0,
    claimedAmount: 0,
    totalAmount: 0,
  };

  public swapNativeTokenInfo: any;

  @ViewChild("sendForm", { static: false }) sendForm;

  constructor(
    private contractService: ContractService,
    private ngZone: NgZone,
    private appComponent: AppComponent
  ) {
    this.accountSubscribe = this.contractService
      .accountSubscribe()
      .subscribe((account: any) => {
        if (!account || account.balances) {
          this.ngZone.run(() => {
            this.account = account;
            window.dispatchEvent(new Event("resize"));
            if (account) {
              console.log(this.account);
              this.getSnapshotInfo();
              this.onChangeAmount();
              this.onChangeAccount.emit();
              this.updateSwapBalanceProgress = true;
              this.readSwapNativeToken();
              this.contractService.swapTokenBalanceOf().then((balance) => {
                this.swapContractBalance = balance;
                this.readPenalty();
                this.updateSwapBalanceProgress = false;
                window.dispatchEvent(new Event("resize"));
              });
            }
          });
        }
      });
    this.tokensDecimals = this.contractService.getCoinsDecimals();
    this.AxnTokenAddress = this.contractService.AxnTokenAddress;
    this.tonkenUrl = this.contractService.settingsApp.settings.tonkenUrl;
  }

  private getSnapshotInfo() {
    this.contractService.getSnapshotInfo().then((res) => {
      this.claimDataInfo = res as any;
    });
  }

  private readSwapNativeToken() {
    this.contractService.readSwapNativeToken().then((result) => {
      this.swapNativeTokenInfo = result;
      window.dispatchEvent(new Event("resize"));
    });
  }

  public onChangeAmount() {
    if (
      this.formsData.swapAmount >
      this.account.balances.H2T.shortBigNumber.toString()
    ) {
      this.formsData.swapAmount = this.account.balances.H2T.shortBigNumber.toString();
    }

    this.dataSendForm =
      Number(this.formsData.swapAmount) <= 0 ||
      this.formsData.swapAmount === undefined
        ? false
        : true;
  }

  private readPenalty() {
    this.contractService
      .calculatePenalty(this.swapContractBalance.fullValue)
      .then((res) => {
        this.clacPenalty = res;

        this.toSwap = new BigNumber(this.swapContractBalance.fullValue).minus(
          this.clacPenalty
        );
      });
  }

  public swapH2T() {
    this.swapTokensProgress = true;
    this.contractService
      .swapH2T(this.formsData.swapAmount)
      .then(() => {
        this.contractService.updateH2TBalance(true).then(() => {
          this.formsData.swapAmount = "";
          this.swapTokensProgress = false;
        });
      })
      .catch(() => {
        this.swapTokensProgress = false;
      });
  }

  public withdrawH2T() {
    this.withdrawH2TProgress = true;
    this.contractService
      .withdrawH2T()
      .then(() => {
        this.contractService.updateH2TBalance(true).then(() => {
          this.withdrawH2TProgress = false;
        });
      })
      .catch(() => {
        this.withdrawH2TProgress = false;
      });
  }

  public burnH2T() {
    this.burnTokensProgress = true;
    this.contractService
      .swapNativeToken()
      .then(() => {
        this.burnTokensProgress = false;

        this.readPenalty();
        this.swapContractBalance = { value: 0, fullValue: 0 };

        this.contractService.updateH2TBalance(true).then(() => {
          this.burnTokensProgress = false;
        });
      })
      .catch(() => {
        this.burnTokensProgress = false;
      });
  }

  public updateUserSnapshot() {
    if (
      !this.account.snapshot.user_dont_have_hex &&
      !this.account.completeClaim.have_forClaim
    ) {
      setTimeout(() => {
        this.contractService.updateUserSnapshot();
        console.log("upd snaphot after claim", this.account);
      }, 5000);
    }
  }

  public claim() {
    this.claimTokensProgress = true;
    this.contractService
      .claimFromForeign()
      .then(() => {
        this.claimTokensProgress = false;
        this.contractService.updateH2TBalance(true).then(() => {
          this.claimTokensProgress = false;
          this.updateUserSnapshot();
        });
      })
      .catch(() => {
        this.claimTokensProgress = false;
      });
  }

  public subscribeAccount() {
    this.appComponent.subscribeAccount();
  }

  ngOnDestroy() {
    this.accountSubscribe.unsubscribe();
  }
}
