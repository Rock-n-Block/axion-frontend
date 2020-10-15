import { Component, NgZone, ViewChild, OnInit } from "@angular/core";
import { TransactionSuccessModalComponent } from "./components/transactionSuccessModal/transaction-success-modal.component";
import { MetamaskErrorComponent } from "./components/metamaskError/metamask-error.component";
import { ContractService } from "./services/contract";
import { MatDialog } from "@angular/material/dialog";
import { ActivationStart, NavigationStart, Router } from "@angular/router";
import { CookieService } from "ngx-cookie-service";
import { AppConfig } from "./appconfig";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
  public isNavbarOpen;
  public isHeaderActive;
  public account;
  private accountSubscribe;
  public leftDaysInfo;
  public leftDaysInfoShow = false;
  public leftDaysInfoChecker = false;
  public addToRopsten = false;
  public theme = "white";
  public chainNetwork = "rinkeby";
  public tableInfo;
  public runLineCountArray = new Array(1);
  @ViewChild("runString", { static: false }) runString;
  constructor(
    private contractService: ContractService,
    private ngZone: NgZone,
    public dialog: MatDialog,
    private cookieService: CookieService,
    private config: AppConfig,
    route: Router
  ) {
    window["ethereum"].on("chainChanged", () => {
      window["ethereum"]
        .request({
          method: "net_version",
        })
        .then((result) => {
          this.addToRopsten = Number(result) === 3;
        });
    });

    window["ethereum"]
      .request({
        method: "net_version",
      })
      .then((result) => {
        this.addToRopsten = Number(result) === 3;
      });

    const settingsData = config.getConfig();
    this.chainNetwork = settingsData.settings.network;

    this.accountSubscribe = this.contractService
      .accountSubscribe()
      .subscribe((account) => {
        if (account) {
          this.accountSubscribe.unsubscribe();
          this.subscribeAccount();

          this.contractService.getEndDateTime().then((result) => {
            this.leftDaysInfo = result;
            this.leftDaysInfoShow = this.leftDaysInfo.leftDays > 0;

            if (this.leftDaysInfoShow) {
              this.leftDaysInfoChecker = true;
              // if (this.account) {
              this.checkDays();
              // }
            }
          });
        }
      });

    this.contractService
      .transactionsSubscribe()
      .subscribe((transaction: any) => {
        console.log("transaction", transaction);

        if (transaction) {
          this.dialog.open(TransactionSuccessModalComponent, {
            width: "440px",
            data: transaction.hash,
          });
        }
      });
    this.contractService.getAccount(true);

    this.isNavbarOpen = false;

    this.contractService.getContractsInfo().then((info) => {
      this.tableInfo = info;
      this.iniRunString();
    });

    this.isHeaderActive = false;

    route.events.subscribe((event) => {
      if (event instanceof ActivationStart) {
        if (event.snapshot.queryParams.ref) {
          this.cookieService.set("ref", event.snapshot.queryParams.ref);
        }
      }

      if (event instanceof NavigationStart) {
        window.scrollTo(0, 0);
      }
    });
  }

  public addToken() {
    this.contractService.addToken();
  }

  public changeTheme() {
    const elem = document.getElementById("myLink");
    const themeName = this.theme === "white" ? "dark" : "white";

    console.log(themeName);
    elem.setAttribute("href", `./${themeName}.css`);
    elem.setAttribute("rel", "stylesheet");
    elem.setAttribute("type", "text/css");

    this.theme = themeName;
  }

  public checkDays() {
    if (this.leftDaysInfoChecker) {
      setTimeout(() => {
        this.contractService.getEndDateTimeCurrent().then((result) => {
          this.leftDaysInfo = result;
          this.leftDaysInfoShow = this.leftDaysInfo.leftDays > 0;
          if (!this.leftDaysInfoShow) {
            this.leftDaysInfoChecker = false;
          } else {
            this.checkDays();
            // console.log("app days checker", result);
          }
        });
      }, 1000);
    }
  }

  public openNavbar() {
    this.isNavbarOpen = !this.isNavbarOpen;
  }

  public subscribeAccount() {
    if (this.account) {
      return;
    }
    this.accountSubscribe = this.contractService
      .accountSubscribe()
      .subscribe((account: any) => {
        this.ngZone.run(() => {
          if (
            account &&
            (!this.account || this.account.address !== account.address)
          ) {
            this.contractService.loadAccountInfo();
          }
          this.account = account;
        });
      });
    this.contractService.getAccount().catch((err) => {
      this.dialog.open(MetamaskErrorComponent, {
        width: "400px",
        data: err,
      });
    });
  }

  iniRunString() {
    const runStringElement = this.runString.nativeElement;
    const runStringItem = runStringElement.getElementsByClassName(
      "repeat-content"
    )[0];
    this.runLineCountArray.length =
      Math.ceil(runStringElement.offsetWidth / runStringItem.offsetWidth) * 2;

    setInterval(() => {
      const allElements = runStringElement.getElementsByClassName(
        "repeat-content"
      );
      const marginLeft = allElements[0].style.marginLeft || "0px";
      const newMarginLeft = marginLeft.replace("px", "") - 1;
      allElements[0].style.marginLeft = newMarginLeft + "px";
      if (-newMarginLeft > allElements[0].offsetWidth) {
        allElements[0].style.marginLeft = 0;
        runStringElement.appendChild(allElements[0]);
      }
    }, 30);
  }

  private onScrollWindow() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    this.isHeaderActive = scrollTop >= 10;
  }

  ngOnInit(): void {
    window.addEventListener("scroll", this.onScrollWindow.bind(this));
  }
}
