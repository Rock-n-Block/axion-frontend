import {
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { ContractService, stakingMaxDays } from "../services/contract";
import BigNumber from "bignumber.js";
import { constants } from "os";
interface StakingInfoInterface {
  ShareRate: number;
  StepsFromStart: number;
  closestYearShares?: string;
  closestPoolAmount?: string;
}

@Component({
  selector: "app-staking-page",
  templateUrl: "./staking-page.component.html",
  styleUrls: ["./staking-page.component.scss"],
})
export class StakingPageComponent implements OnDestroy {
  public account;
  public tableInfo;
  public tokensDecimals;
  public depositMaxDays = 0;
  private accountSubscribe;
  public shareRate: any;
  public stakeDays: any;
  public onChangeAccount: EventEmitter<any> = new EventEmitter();
  public formsData: {
    depositAmount?: string;
    depositDays?: number;
  } = {};
  public depositTokensProgress: boolean;
  public depositsLists: {
    opened?: any;
    closed?: any;
  };
  @ViewChild("depositForm", { static: false }) depositForm;

  public stakingContractInfo: StakingInfoInterface = {
    ShareRate: 0,
    StepsFromStart: 0,
    closestYearShares: "0",
    closestPoolAmount: "0",
  };

  public currentSort: {
    opened: any;
    closed: any;
  } = {
    opened: {},
    closed: {},
  };

  public bpd: any = [];

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
              this.onChangeAccount.emit();
              this.contractService.getAccountStakes().then((res) => {
                this.depositsLists = res;
                this.applySort("opened");
                this.applySort("closed");
                window.dispatchEvent(new Event("resize"));
              });
            }
          });
        }
      });

    this.contractService
      .getStakingContractInfo()
      .then((data: StakingInfoInterface) => {
        this.stakingContractInfo = data;
        this.depositMaxDays =
          stakingMaxDays - this.stakingContractInfo.StepsFromStart;
        window.dispatchEvent(new Event("resize"));
      });

    this.tokensDecimals = this.contractService.getCoinsDecimals();

    this.contractService.geBPDInfo().then((result) => {
      console.log(result);
      this.bpd = result;
    });
  }

  public openDeposit() {
    this.depositTokensProgress = true;
    this.contractService
      .depositHEX2X(this.formsData.depositAmount, this.formsData.depositDays)
      .then((r) => {
        this.contractService.updateHEX2XBalance(true).then(() => {
          this.depositTokensProgress = false;
        });
        this.formsData = {};
      })
      .catch(() => {
        this.depositTokensProgress = false;
      });
  }

  // get stakeDays() {
  //   return (
  //     Number(this.stakingContractInfo.StepsFromStart) +
  //     (Number(this.formsData.depositDays) || 0)
  //   );
  // }

  get bonusLongerPays() {
    const currentValue = new BigNumber(this.formsData.depositAmount || 0);
    return currentValue
      .times((this.formsData.depositDays || 1) - 1)
      .div(stakingMaxDays);
  }

  get userShares() {
    const divDecimals = Math.pow(10, this.tokensDecimals.HEX2X);
    return new BigNumber(this.formsData.depositAmount || 0)
      .div(divDecimals)
      .times(this.bonusLongerPays.div(divDecimals).plus(1))
      .div(this.stakingContractInfo.ShareRate || 1)
      .times(divDecimals);
  }

  // get depositMaxDays() {
  //   console.log(stakingMaxDays - this.stakingContractInfo.StepsFromStart);
  //   console.log(stakingMaxDays, this.stakingContractInfo.StepsFromStart);
  //   return stakingMaxDays - this.stakingContractInfo.StepsFromStart;
  // }

  get depositDaysInvalid() {
    return (this.formsData.depositDays || 0) > this.depositMaxDays;
  }

  public onChangeAmount() {
    const divDecimals = Math.pow(10, this.tokensDecimals.HEX2X);
    this.shareRate = new BigNumber(this.formsData.depositAmount || 0)
      .div(divDecimals)
      .times(this.bonusLongerPays.div(divDecimals).plus(1))
      .div(this.stakingContractInfo.ShareRate || 1)
      .times(divDecimals);

    // day hours = day minutes/60
    // day minutes = day seconds/60 = 15
    // day seconds = 900

    this.stakeDays =
      Date.now() +
      (this.stakingContractInfo.StepsFromStart + this.formsData.depositDays) *
        900000;
  }

  public getProgress(deposit) {
    if (deposit.oldUpdate && new Date().getTime() - deposit.oldUpdate < 5000) {
      return deposit.progress;
    }
    deposit.oldUpdate = new Date().getTime();
    const fullAge = deposit.end.getTime() - deposit.start.getTime();
    const backAge = new Date().getTime() - deposit.start.getTime();
    deposit.progress = Math.min(Math.round(backAge / (fullAge / 100)), 100);
    return deposit.progress;
  }

  private applySort(table) {
    const currentTableState = this.currentSort[table];
    if (currentTableState.field) {
      this.depositsLists[table].sort((a, b) => {
        let aValue = a[currentTableState.field];
        let bValue = b[currentTableState.field];

        switch (currentTableState.field) {
          case "start":
          case "end":
            aValue = aValue.getTime();
            bValue = bValue.getTime();
            break;
          case "amount":
          case "shares":
            aValue = aValue.toNumber();
            bValue = bValue.toNumber();
            break;
        }

        return aValue > bValue
          ? currentTableState.ask
            ? 1
            : -1
          : aValue < bValue
          ? currentTableState.ask
            ? -1
            : 1
          : 1;
      });
    } else {
      this.depositsLists[table].sort((a, b) => {
        return Number(a.sessionId) > Number(b.sessionId) ? 1 : -1;
      });
    }
  }

  public sortDeposits(table, field) {
    const currentTableState = this.currentSort[table];
    const currentUseField = currentTableState.field;

    if (currentUseField !== field) {
      currentTableState.field = field;
      currentTableState.ask = false;
    } else {
      if (!currentTableState.ask) {
        currentTableState.ask = true;
      } else {
        currentTableState.field = undefined;
      }
    }
    this.applySort(table);
  }

  public depositWithdraw(deposit) {
    deposit.withdrawProgress = true;
    this.contractService
      .unstake(deposit.sessionId)
      .then(() => {
        this.contractService.updateHEX2XBalance(true);
      })
      .catch(() => {
        deposit.withdrawProgress = false;
      });
  }

  ngOnDestroy() {
    this.accountSubscribe.unsubscribe();
  }
}
