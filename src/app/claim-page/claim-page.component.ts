import {
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
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

  public dataSendForm = false;

  public clacPenalty = 0;
  public toSwap = 0;

  public swapNativeTokenInfo: any;

  @ViewChild("sendForm", { static: false }) sendForm;

  constructor(
    private contractService: ContractService,
    private ngZone: NgZone
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
    console.log(this.tokensDecimals);
  }

  private readSwapNativeToken() {
    this.contractService.readSwapNativeToken().then((result) => {
      this.swapNativeTokenInfo = result;
      // console.log("swap native token info", this.swapNativeTokenInfo);
      window.dispatchEvent(new Event("resize"));
    });
  }

  public onChangeAmount() {
    // console.log(this.formsData.swapAmount);
    // console.log(this.account.balances.H2T.wei);
    // console.log(this.account.balances.H2T.shortBigNumber.toString());

    if (
      this.formsData.swapAmount >
      this.account.balances.H2T.shortBigNumber.toString()
    ) {
      this.formsData.swapAmount = this.account.balances.H2T.shortBigNumber.toString();
      // console.log("HIGH!!!!");
    }

    this.dataSendForm =
      Number(this.formsData.swapAmount) <= 0 ||
      this.formsData.swapAmount === undefined
        ? false
        : true;
  }

  private readPenalty() {
    // console.log(this.swapContractBalance);

    this.contractService
      .calculatePenalty(this.swapContractBalance.fullValue)
      .then((res) => {
        this.clacPenalty = res;

        // this.clacPenalty = new BigNumber(this.clacPenalty)
        //   .div(Math.pow(10, this.tokensDecimals.HEX2X))
        //   .toNumber()
        //   .toFixed(3) as any;

        this.toSwap = this.swapContractBalance.fullValue - this.clacPenalty;

        // console.log("claculate penalty", this.clacPenalty);
        // console.log("toSwap", this.toSwap);
        // console.log("account?.balances.H2T", this.account.balances.H2T);
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

        console.log("swap contract balance", this.swapContractBalance);
      })
      .catch(() => {
        this.burnTokensProgress = false;
      });
  }

  public claim() {
    this.claimTokensProgress = true;
    this.contractService
      .claimFromForeign()
      .then(() => {
        this.claimTokensProgress = false;
        this.contractService.updateH2TBalance(true).then(() => {
          this.claimTokensProgress = false;
        });
      })
      .catch(() => {
        this.claimTokensProgress = false;
      });
  }

  ngOnDestroy() {
    this.accountSubscribe.unsubscribe();
  }
}
