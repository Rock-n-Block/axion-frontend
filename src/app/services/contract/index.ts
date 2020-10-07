import { resolve } from "url";
// import { CONTRACTS_PARAMS } from "./constants";
import { MetamaskService } from "../web3";
import { Contract } from "web3-eth-contract";
import { Observable } from "rxjs";
import { Injectable } from "@angular/core";
import BigNumber from "bignumber.js";
import { HttpClient } from "@angular/common/http";
import * as moment from "moment";
// import "moment-duration-format";
// var momentDurationFormatSetup = require("moment-duration-format");
import { settingsData } from "../../params";

// const swapDays = 350;
export const stakingMaxDays = 1820;
// const oneDaySeconds = 86400;

interface DepositInterface {
  start: Date;
  end: Date;
  shares: BigNumber;
  amount: BigNumber;
  isActive: boolean;
  sessionId: string;
  bigPayDay: BigNumber;
  withdrawProgress?: boolean;
}

@Injectable({
  providedIn: "root",
})
export class ContractService {
  private web3Service;

  private H2TContract: Contract;
  private HEX2XContract: Contract;
  private HEXContract: Contract;
  private NativeSwapContract: Contract;

  private StakingContract: Contract;
  private UniswapV2Router02: Contract;
  private Auction: Contract;

  private ForeignSwapContract: Contract;
  private BPDContract: Contract;
  private SubBalanceContract: Contract;

  private tokensDecimals: any = {
    ETH: 18,
  };
  public account;
  private allAccountSubscribers = [];
  private allTransactionSubscribers = [];
  public settingsApp = {
    settings: {
      production: false,
      network: "rinkeby",
      tonkenUrl: "https://rinkeby.etherscan.io/token/",
      net: 4,
      time: {
        seconds: 900,
        display: "minutes",
      },
    },
    minutes: {
      name: "Minutes",
      shortName: "Min",
      lowerName: "minutes",
    },
    days: {
      name: "Days",
      shortName: "Days",
      lowerName: "days",
    },
  };

  private dateToEnd: any;
  private swapDaysPeriod: any;
  private secondsInDay: any;
  private startDate: any;

  private CONTRACTS_PARAMS: any;

  public AxnTokenAddress = "none";

  constructor(private httpService: HttpClient) {}

  private initAll() {
    this.settingsApp = settingsData;

    const promises = [
      this.httpService
        .get(`/assets/js/constants.json?v=${new Date().getTime()}`)
        .toPromise()
        .then((result) => {
          // const IS_PRODUCTION = location.protocol === "https:";
          const IS_PRODUCTION = this.settingsApp.settings.production;
          const CONTRACTS_PARAMS =
            result[
              IS_PRODUCTION ? "mainnet" : this.settingsApp.settings.network
            ];

          this.CONTRACTS_PARAMS = CONTRACTS_PARAMS;
          this.web3Service = new MetamaskService();
          this.initializeContracts();
        }),
    ];
    return Promise.all(promises);
  }

  public addToken() {
    this.web3Service.addToken();
  }

  public getSettings() {
    return this.settingsApp;
  }

  private getTokensInfo(noEnable?) {
    if (!noEnable) {
      this.initializeContracts();
    }
    const promises = [
      this.H2TContract.methods
        .decimals()
        .call()
        .then((decimals) => {
          this.tokensDecimals.H2T = decimals;
        }),
      this.HEX2XContract.methods
        .decimals()
        .call()
        .then((decimals) => {
          this.tokensDecimals.HEX2X = decimals;
        }),
      this.HEXContract.methods
        .decimals()
        .call()
        .then((decimals) => {
          this.tokensDecimals.HEX = decimals;
        }),
    ];
    return Promise.all(promises);
  }

  public getStaticInfo() {
    return this.initAll().then((res) => {
      const promises = [this.getTokensInfo(false)];
      return Promise.all(promises);
    });
  }

  private callAllAccountsSubscribers() {
    this.allAccountSubscribers.forEach((observer) => {
      observer.next(this.account);
    });
  }
  private callAllTransactionsSubscribers(transaction) {
    this.allTransactionSubscribers.forEach((observer) => {
      observer.next(transaction);
    });
  }

  public accountSubscribe() {
    const newObserver = new Observable((observer) => {
      observer.next(this.account);
      this.allAccountSubscribers.push(observer);
      return {
        unsubscribe: () => {
          this.allAccountSubscribers = this.allAccountSubscribers.filter(
            (a) => a !== newObserver
          );
        },
      };
    });
    return newObserver;
  }

  public updateClaimableInformation(callEmitter?) {
    return this.ForeignSwapContract.methods
      .getUserClaimableAmountFor(this.account.snapshot.hex_amount)
      .call()
      .then((result) => {
        this.account.claimableInfo = {
          claim: new BigNumber(result[0]),
          penalty: new BigNumber(result[1]),
        };
        if (callEmitter) {
          this.callAllAccountsSubscribers();
        }
      });
  }

  public updateClaimableInformationHex(callEmitter?) {
    return this.ForeignSwapContract.methods
      .claimedBalanceOf(this.account.snapshot.user_address)
      .call()
      .then((result) => {
        this.account.completeClaim = {
          have_forClaim: new BigNumber(result).toNumber() > 0,
          value: new BigNumber(result).div(10000000000).toNumber(),
          valueFull: new BigNumber(result),
        };
        if (callEmitter) {
          this.callAllAccountsSubscribers();
        }
      });
  }

  public transactionsSubscribe() {
    const newObserver = new Observable((observer) => {
      this.allTransactionSubscribers.push(observer);
    });
    return newObserver;
  }

  public getAccount(noEnable?) {
    const finishIniAccount = () => {
      if (!noEnable) {
        this.initializeContracts();
      }
      if (this.account) {
        this.getAccountSnapshot().then(() => {
          // if (this.account.snapshot.user_dont_have_hex) {
          this.updateClaimableInformation(true);
          this.updateClaimableInformationHex(true);
          // }
        });
      } else {
        this.callAllAccountsSubscribers();
      }
    };
    return new Promise((resolve, reject) => {
      this.web3Service.getAccounts(noEnable).subscribe(
        (account) => {
          if (!this.account || account.address !== this.account.address) {
            this.account = account;
            finishIniAccount();
          }
          resolve(this.account);
        },
        (err) => {
          this.account = false;
          finishIniAccount();
          reject(err);
        }
      );
    });
  }

  public getSnapshotInfo() {
    const promises = [
      this.ForeignSwapContract.methods
        .getCurrentClaimedAddresses()
        .call()
        .then((claimedAddresses) => {
          return {
            key: "claimedAddresses",
            value: claimedAddresses,
          };
        }),
      this.ForeignSwapContract.methods
        .getTotalSnapshotAddresses()
        .call()
        .then((totalAddresses) => {
          return {
            key: "totalAddresses",
            value: totalAddresses,
          };
        }),
      this.ForeignSwapContract.methods
        .getCurrentClaimedAmount()
        .call()
        .then((claimedAmount) => {
          return {
            key: "claimedAmount",
            value: new BigNumber(claimedAmount).div(10000000000),
          };
        }),
      this.ForeignSwapContract.methods
        .getTotalSnapshotAmount()
        .call()
        .then((totalAmount) => {
          return {
            key: "totalAmount",
            value: new BigNumber(totalAmount).div(10000000000),
          };
        }),
    ];
    return Promise.all(promises).then((results) => {
      const info = {};
      results.forEach((params) => {
        info[params.key] = params.value;
      });
      console.log(info);
      return info;
    });
  }

  public updateH2TBalance(callEmitter?) {
    return new Promise((resolve, reject) => {
      if (!(this.account && this.account.address)) {
        return reject();
      }
      return this.H2TContract.methods
        .balanceOf(this.account.address)
        .call()
        .then((balance) => {
          const bigBalance = new BigNumber(balance);
          this.account.balances = this.account.balances || {};
          this.account.balances.H2T = {
            wei: balance,
            weiBigNumber: bigBalance,
            shortBigNumber: bigBalance.div(
              new BigNumber(10).pow(this.tokensDecimals.H2T)
            ),
            display: bigBalance
              .div(new BigNumber(10).pow(this.tokensDecimals.H2T))
              .toFormat(4),
          };
          resolve();
          if (callEmitter) {
            this.callAllAccountsSubscribers();
          }
        });
    });
  }

  public updateHEX2XBalance(callEmitter?) {
    return new Promise((resolve, reject) => {
      if (!(this.account && this.account.address)) {
        return reject();
      }
      return this.HEX2XContract.methods
        .balanceOf(this.account.address)
        .call()
        .then((balance) => {
          const bigBalance = new BigNumber(balance);
          this.account.balances = this.account.balances || {};
          this.account.balances.HEX2X = {
            wei: balance,
            weiBigNumber: bigBalance,
            shortBigNumber: bigBalance.div(
              new BigNumber(10).pow(this.tokensDecimals.H2T)
            ),
            display: bigBalance
              .div(new BigNumber(10).pow(this.tokensDecimals.H2T))
              .toFormat(4),
          };
          resolve();
          if (callEmitter) {
            this.callAllAccountsSubscribers();
          }
        });
    });
  }

  public updateHEXBalance(callEmitter?) {
    return new Promise((resolve, reject) => {
      if (!(this.account && this.account.address)) {
        return reject();
      }
      return this.HEXContract.methods
        .balanceOf(this.account.address)
        .call()
        .then((balance) => {
          const bigBalance = new BigNumber(balance);
          this.account.balances = this.account.balances || {};
          this.account.balances.HEX = {
            wei: balance,
            weiBigNumber: bigBalance,
            shortBigNumber: bigBalance.div(
              new BigNumber(10).pow(this.tokensDecimals.HEX)
            ),
            display: bigBalance
              .div(new BigNumber(10).pow(this.tokensDecimals.HEX))
              .toFormat(4),
          };
          resolve();
          if (callEmitter) {
            this.callAllAccountsSubscribers();
          }
        });
    });
  }

  public updateETHBalance(callEmitter?) {
    return new Promise((resolve, reject) => {
      if (!(this.account && this.account.address)) {
        return reject();
      }
      return this.web3Service
        .getBalance(this.account.address)
        .then((balance) => {
          const bigBalance = new BigNumber(balance);
          this.account.balances = this.account.balances || {};
          this.account.balances.ETH = {
            wei: balance,
            weiBigNumber: bigBalance,
            shortBigNumber: bigBalance.div(new BigNumber(10).pow(18)),
            display: bigBalance.div(new BigNumber(10).pow(18)).toFormat(4),
          };
          resolve();
          if (callEmitter) {
            this.callAllAccountsSubscribers();
          }
        });
    });
  }

  public getCoinsDecimals() {
    return this.tokensDecimals;
  }

  public loadAccountInfo() {
    const promises = [
      this.updateH2TBalance(),
      this.updateHEX2XBalance(),
      this.updateETHBalance(),
      this.updateHEXBalance(),
    ];
    Promise.all(promises).then(() => {
      this.callAllAccountsSubscribers();
    });
  }

  private checkTx(tx, resolve, reject) {
    this.web3Service.Web3.eth
      .getTransaction(tx.transactionHash)
      .then((txInfo) => {
        if (txInfo.blockNumber) {
          this.callAllTransactionsSubscribers(txInfo);
          resolve(tx);
        } else {
          setTimeout(() => {
            this.checkTx(tx, resolve, reject);
          }, 2000);
        }
      }, reject);
  }

  private checkTransaction(tx) {
    return new Promise((resolve, reject) => {
      this.checkTx(tx, resolve, reject);
    });
  }

  private checkH2TApproval(amount, address?): Promise<any> {
    return new Promise((resolve, reject) => {
      this.H2TContract.methods
        .allowance(this.account.address, address)
        .call()
        .then((allowance: string) => {
          const allow = new BigNumber(allowance);
          const allowed = allow.minus(amount);
          allowed.isNegative() ? reject() : resolve();
        });
    });
  }

  private checkHEX2XApproval(amount, address?): Promise<any> {
    return new Promise((resolve, reject) => {
      this.HEX2XContract.methods
        .allowance(this.account.address, address)
        .call()
        .then((allowance: string) => {
          const allow = new BigNumber(allowance);
          const allowed = allow.minus(amount);
          allowed.isNegative() ? reject() : resolve();
        });
    });
  }

  public swapH2T(amount) {
    const fromAccount = this.account.address;

    const exchangeTokens = (resolve, reject) => {
      return this.NativeSwapContract.methods
        .deposit(amount)
        .send({
          from: fromAccount,
        })
        .then((res) => {
          return this.checkTransaction(res);
        })
        .then(resolve, reject);
    };

    return new Promise((resolve, reject) => {
      this.checkH2TApproval(
        amount,
        this.NativeSwapContract.options.address
      ).then(
        () => {
          exchangeTokens(resolve, reject);
        },
        () => {
          this.H2TContract.methods
            .approve(this.NativeSwapContract.options.address, amount)
            .send({
              from: fromAccount,
            })
            .then(() => {
              exchangeTokens(resolve, reject);
            }, reject);
        }
      );
    });
  }

  public swapTokenBalanceOf(noConverted?) {
    return this.NativeSwapContract.methods
      .swapTokenBalanceOf(this.account.address)
      .call()
      .then((balance) => {
        if (noConverted) {
          return balance;
        }

        return {
          value: new BigNumber(balance).div(
            new BigNumber(10).pow(this.tokensDecimals.H2T)
          ),
          fullValue: new BigNumber(balance),
          fullValueNotBN: balance,
          fullValueNumber: Number(balance),
        };
      });
  }

  public withdrawH2T() {
    return this.swapTokenBalanceOf(true).then((value) => {
      return this.NativeSwapContract.methods
        .withdraw(value)
        .send({
          from: this.account.address,
        })
        .then((res) => {
          return this.checkTransaction(res);
        });
    });
  }

  public swapNativeToken() {
    return this.NativeSwapContract.methods
      .swapNativeToken()
      .send({
        from: this.account.address,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  public getContractsInfo() {
    const promises = [
      this.Auction.methods
        .calculateStepsFromStart()
        .call()
        .then((auctionId) => {
          return this.Auction.methods
            .reservesOf(auctionId)
            .call()
            .then((res) => {
              return {
                key: "Auction",
                value: new BigNumber(res[1])
                  .div(Math.pow(10, this.tokensDecimals.HEX2X))
                  .toString(),
              };
            });
        }),
      this.HEX2XContract.methods
        .totalSupply()
        .call()
        .then((res) => {
          return {
            key: "totalSupply",
            value: new BigNumber(res)
              .div(Math.pow(10, this.tokensDecimals.HEX2X))
              .toString(),
          };
        }),
      this.StakingContract.methods
        .sharesTotalSupply()
        .call()
        .then((res) => {
          return {
            key: "staking",
            value: new BigNumber(res)
              .div(Math.pow(10, this.tokensDecimals.HEX2X))
              .toString(),
          };
        }),
      this.BPDContract.methods
        .getPoolYearAmounts()
        .call()
        .then((res) => {
          return {
            key: "BPDInfo",
            value: res.map((oneBigPayDay) => {
              return new BigNumber(oneBigPayDay)
                .div(Math.pow(10, this.tokensDecimals.HEX2X))
                .toString();
            }),
          };
        }),
    ];
    return Promise.all(promises).then((results) => {
      const info = {};
      results.forEach((params) => {
        info[params.key] = params.value;
      });
      return info;
    });
  }

  public getAuctionPool() {
    return new Promise((resolve) => {
      this.Auction.methods
        .calculateStepsFromStart()
        .call()
        .then((auctionId) => {
          return this.Auction.methods
            .reservesOf(auctionId)
            .call()
            .then((res) => {
              const data = {} as any;

              data.eth = new BigNumber(res[0])
                .div(Math.pow(10, this.tokensDecimals.ETH))
                .toFixed(8)
                .toString();

              data.axn = new BigNumber(res[1])
                .div(Math.pow(10, this.tokensDecimals.HEX2X))
                .toFixed(8)
                .toString();

              // data.axnToEth = parseFloat(
              //   (Number(data.eth) / Number(data.axn)).toFixed(8).toString()
              // );

              data.axnToEth = parseFloat(
                new BigNumber(data.eth)
                  .div(new BigNumber(data.axn).toNumber())
                  .toFixed(8)
                  .toString()
              );

              data.eth = parseFloat(data.eth);
              data.axn = parseFloat(data.axn);

              const amount = "1000000000000000000";

              this.UniswapV2Router02.methods
                .getAmountsOut(amount, [
                  this.CONTRACTS_PARAMS.HEX2X.ADDRESS,
                  this.CONTRACTS_PARAMS.WETH.ADDRESS,
                ])
                .call()
                .then((value) => {
                  // console.log("uniswap value request", value);

                  const axn = new BigNumber(value[1])
                    .div(Math.pow(10, this.tokensDecimals.HEX2X))
                    .toString();

                  data.uniToEth = parseFloat(
                    new BigNumber(axn).toNumber().toFixed(8).toString()
                  );

                  this.Auction.methods
                    .uniswapPercent()
                    .call()
                    .then((res) => {
                      // const v = Number(data.uniToEth) * (1 - res / 100);
                      const v =
                        new BigNumber(data.uniToEth).toNumber() *
                        (1 - res / 100);

                      if ((data.axnToEth || 0) < v) {
                        data.axnToEth = parseFloat(v.toFixed(8).toString());
                      }
                    });

                  resolve(data);
                });
            });
        });
    });
  }

  public getEndDateTime() {
    return this.ForeignSwapContract.methods
      .stepTimestamp()
      .call()
      .then((secondsInDay) => {
        return this.ForeignSwapContract.methods
          .stakePeriod()
          .call()
          .then((swapDaysPeriod) => {
            const allDaysSeconds = swapDaysPeriod * secondsInDay * 1000;
            return this.ForeignSwapContract.methods
              .start()
              .call()
              .then((startDate) => {
                const fullStartDate = startDate * 1000;
                const endDateTime = fullStartDate + allDaysSeconds;
                // const leftDays = Math.floor(
                //   (endDateTime - new Date().getTime()) / allDaysSeconds
                // );

                this.swapDaysPeriod = swapDaysPeriod;
                this.secondsInDay = secondsInDay;
                this.startDate = startDate;

                const a = moment(new Date(endDateTime));
                const b = moment(new Date());

                const leftDays = a.diff(
                  b,
                  this.settingsApp[this.settingsApp.settings.time.display]
                    .lowerName
                );
                const dateEnd = a.diff(
                  b,
                  this.settingsApp[this.settingsApp.settings.time.display]
                    .lowerName
                );

                const leftDays2 = a.diff(b);

                this.dateToEnd = leftDays2;

                // let duration = moment.duration(decimalHours, "hours");
                // let options: moment.DurationFormatSettings = {
                //   forceLength: false,
                //   precision: 0,
                //   template: formatString,
                //   trim: false,
                // };
                // let result = duration.format(formatString, 0, options);

                // let dd = moment.duration(400.99, 'hours');

                const showTime = leftDays;

                // const showTime = moment.utc(leftDays2).format("dd HH mm ss");
                // const showTime = {
                //   h: moment.utc(leftDays2).hours(),
                //   m: moment.utc(leftDays2).minutes(),
                //   s: moment.utc(leftDays2).seconds(),
                // };

                // const showTime = moment
                //   .duration(67, "minutes")
                //   .humanize(false, { h: 24, m: 60, s: 60 });

                // const showTime = momentDurationFormatSetup
                //   .duration(leftDays, "minutes")
                //   .format();

                return {
                  startDate: fullStartDate,
                  endDate: endDateTime,
                  dateEnd,
                  leftDays,
                  showTime,
                };
              });
          });
      });
  }

  public getEndDateTimeCurrent() {
    return new Promise((resolve) => {
      const allDaysSeconds = this.swapDaysPeriod * this.secondsInDay * 1000;
      const fullStartDate = this.startDate * 1000;
      const endDateTime = fullStartDate + allDaysSeconds;
      const a = moment(new Date(endDateTime));
      const b = moment(new Date());

      const leftDays = a.diff(
        b,
        this.settingsApp[this.settingsApp.settings.time.display].lowerName
      );

      const dateEnd = a.diff(
        b,
        this.settingsApp[this.settingsApp.settings.time.display].lowerName
      );

      const leftDaysToShow = a.diff(b);

      const showTime = {
        h: moment.utc(leftDaysToShow).hours(),
        m: moment.utc(leftDaysToShow).minutes(),
        s: moment.utc(leftDaysToShow).seconds(),
      };

      // console.log("showTime", showTime);

      resolve({
        startDate: fullStartDate,
        endDate: endDateTime,
        dateEnd,
        leftDays,
        showTime,
      });
    });
  }

  public readSwapNativeToken() {
    return this.swapTokenBalanceOf(true).then((value) => {
      return this.NativeSwapContract.methods
        .calculateDeltaPenalty(value)
        .call()
        .then((res) => {
          return res;
        });
    });
  }

  public calculatePenalty(amount) {
    return this.NativeSwapContract.methods
      .calculateDeltaPenalty(amount.toString())
      .call()
      .then((res) => {
        return res;
      });
  }

  /* Staking */
  public depositHEX2X(amount, days) {
    const fromAccount = this.account.address;
    const depositTokens = (resolve, reject) => {
      return this.StakingContract.methods
        .stake(amount, days)
        .send({
          from: fromAccount,
        })
        .then((res) => {
          return this.checkTransaction(res);
        })
        .then(resolve, reject);
    };

    return new Promise((resolve, reject) => {
      this.checkHEX2XApproval(
        amount,
        this.StakingContract.options.address
      ).then(
        () => {
          depositTokens(resolve, reject);
        },
        () => {
          this.HEX2XContract.methods
            .approve(this.StakingContract.options.address, amount)
            .send({
              from: fromAccount,
            })
            .then(() => {
              depositTokens(resolve, reject);
            }, reject);
        }
      );
    });
  }

  public getStakingContractInfo() {
    const promises = [
      this.StakingContract.methods
        .startContract()
        .call()
        .then((startContract) => {
          return this.StakingContract.methods
            .stepTimestamp()
            .call()
            .then((stepTimestamp) => {
              const result =
                (Math.round(Date.now() / 1000) - startContract) / stepTimestamp;
              return {
                key: "StepsFromStart",
                value: result === Infinity ? 0 : result,
              };
            });
        }),
      this.StakingContract.methods
        .shareRate()
        .call()
        .then((result) => {
          return {
            key: "ShareRate",
            value: result,
          };
        }),
      this.SubBalanceContract.methods
        .getClosestYearShares()
        .call()
        .then((result) => {
          return {
            key: "closestYearShares",
            value: result,
          };
        }),
      this.BPDContract.methods
        .getClosestPoolAmount()
        .call()
        .then((result) => {
          return {
            key: "closestPoolAmount",
            value: result,
          };
        }),
    ];
    return Promise.all(promises).then((results) => {
      const values = {};
      results.forEach((v) => {
        values[v.key] = v.value;
      });
      return values;
    });
  }

  public getDaysInYear() {
    return new Promise((resolve) => {
      this.SubBalanceContract.methods
        .basePeriod()
        .call()
        .then((result) => {
          resolve(result);
        });
    });
  }

  public geBPDInfo() {
    const promises = [
      this.getDaysInYear().then((daysInYear) => {
        return {
          key: "daysInYear",
          value: daysInYear,
        };
      }),
      this.getContractsInfo().then((contracts) => {
        return {
          key: "contracts",
          value: contracts,
        };
      }),
      this.SubBalanceContract.methods
        .getStartTimes()
        .call()
        .then((getStartTimes) => {
          return {
            key: "contractsStartTimes",
            value: getStartTimes,
          };
        }),
      this.getEndDateTime().then((dateInfo) => {
        return {
          key: "dateInfo",
          value: dateInfo,
        };
      }),
      this.StakingContract.methods
        .stepTimestamp()
        .call()
        .then((stepTimestamp) => {
          return {
            key: "stepTimestamp",
            value: stepTimestamp,
          };
        }),
    ];

    return Promise.all(promises).then((results) => {
      const values = {} as any;

      results.forEach((v) => {
        values[v.key] = v.value;
      });

      const bpdInfo = values as any;
      const bpd: any = [];
      let count = 0;

      bpdInfo.contracts.BPDInfo.map((value) => {
        const data = {
          value: 0,
          year: 0,
          dateEnd: 0,
          daysLeft: 0,
          show: true,
          seconds: 0,
        };

        data.value = value;
        data.year =
          count > 0
            ? bpdInfo.daysInYear * (count + 1)
            : Number(bpdInfo.daysInYear);

        data.dateEnd = bpdInfo.contractsStartTimes[count] * 1000;

        data.daysLeft = Math.round(
          (data.dateEnd - Date.now()) / (bpdInfo.stepTimestamp * 1000)
        );

        const a = moment(new Date(data.dateEnd));
        const b = moment(new Date());

        data.daysLeft = a.diff(
          b,
          this.settingsApp[this.settingsApp.settings.time.display].lowerName
        );
        data.seconds = a.diff(b, "seconds");

        data.show = a.diff(b, "seconds") < 0 ? false : true;

        bpd.push(data);

        count++;
      });

      return bpd;
    });
  }

  public getAccountStakes(): Promise<{
    closed: DepositInterface[];
    opened: DepositInterface[];
  }> {
    return this.StakingContract.methods
      .sessionsOf_(this.account.address)
      .call()
      .then((sessions) => {
        const sessionsPromises: DepositInterface[] = sessions.map(
          (sessionId) => {
            return this.StakingContract.methods
              .sessionDataOf(this.account.address, sessionId)
              .call()
              .then((oneSession) => {
                return this.SubBalanceContract.methods
                  .calculateSessionPayout(sessionId)
                  .call()
                  .then((result) => {
                    let interest = 1;

                    return this.StakingContract.methods
                      .calculateStakingInterest(
                        sessionId,
                        this.account.address,
                        oneSession.shares
                      )
                      .call()
                      .then((res) => {
                        return this.StakingContract.methods
                          .getAmountOutAndPenalty(sessionId, res)
                          .call()
                          .then((resultInterest) => {
                            // console.log(
                            //   "interest from request",
                            //   resultInterest
                            // );
                            // console.log(
                            //   "interest[0] with bignumber",
                            //   new BigNumber(resultInterest[0])
                            //     .div(Math.pow(10, this.tokensDecimals.HEX2X))
                            //     .toString()
                            // );
                            // console.log(
                            //   "interest[1] with bignumber",
                            //   new BigNumber(resultInterest[1])
                            //     .div(Math.pow(10, this.tokensDecimals.HEX2X))
                            //     .toString()
                            // );

                            // console.log(resultInterest[1].length);

                            interest =
                              resultInterest[1].length < 40
                                ? resultInterest[1]
                                : 0;

                            return {
                              start: new Date(oneSession.start * 1000),
                              end: new Date(oneSession.end * 1000),
                              shares: new BigNumber(oneSession.shares),
                              amount: new BigNumber(oneSession.amount),
                              isActive: oneSession.sessionIsActive,
                              sessionId,
                              bigPayDay: new BigNumber(result[0]),
                              interest,
                            };
                          });
                      });
                  });
              });
          }
        );
        return Promise.all(sessionsPromises).then(
          (allDeposits: DepositInterface[]) => {
            return {
              closed: allDeposits.filter((deposit: DepositInterface) => {
                return new BigNumber(deposit.shares).toNumber() <= 0;
              }),
              opened: allDeposits.filter((deposit: DepositInterface) => {
                return new BigNumber(deposit.shares).toNumber() > 0;
              }),
            };
          }
        );
      });
  }

  public unstake(sessionId) {
    return this.StakingContract.methods
      .unstake(sessionId)
      .send({
        from: this.account.address,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  public getSessionStats(sessionId) {
    return this.SubBalanceContract.methods
      .getSessionStats(sessionId)
      .call()
      .then((res) => {
        return res;
      });
  }

  public stakingWithdraw(sessionId) {
    return this.SubBalanceContract.methods
      .withdraw(sessionId)
      .call()
      .then((res) => {
        return res;
      });
  }

  // Auction
  public getAuctionInfo() {
    const retData = {} as any;
    return this.Auction.methods
      .calculateStepsFromStart()
      .call()
      .then((auctionId) => {
        const promises = [
          this.Auction.methods
            .reservesOf(auctionId)
            .call()
            .then((result) => {
              retData.ethPool = result[0];
              retData.axnPool = result[1];
            }),
        ];
        if (this.account) {
          promises.push(
            this.Auction.methods
              .auctionBetOf(auctionId, this.account.address)
              .call()
              .then((result) => {
                retData.currentUserBalance = result;
              })
          );
        }
        return Promise.all(promises).then(() => {
          return retData;
        });
      });
  }

  // public getCurrentAuction() {
  //   return this.Auction.methods
  //     .currentAuctionId()
  //     .call()
  //     .then((res) => {
  //       // console.log(res);
  //       return res;
  //     });
  // }

  public async sendMaxETHToAuction(amount, ref?) {
    const date = Math.round(
      (new Date().getTime() + 24 * 60 * 60 * 1000) / 1000
    );
    const refLink = ref
      ? ref.toLowerCase()
      : "0x0000000000000000000000000000000000000000".toLowerCase();

    const dataForFee = await this.web3Service.encodeFunctionCall(
      "bet",
      "function",
      [
        {
          internalType: "uint256",
          name: "deadline",
          type: "uint256",
        },
        { internalType: "address", name: "ref", type: "address" },
      ],
      [date, refLink]
    );

    const gasPrice = await this.web3Service.gasPrice();

    return this.web3Service
      .estimateGas(
        this.account.address,
        this.CONTRACTS_PARAMS.Auction.ADDRESS,
        amount,
        dataForFee,
        gasPrice
      )
      .then((res) => {
        const feeRate = res;
        const newAmount = new BigNumber(amount).minus(feeRate * gasPrice);

        return this.Auction.methods
          .bet(date, refLink)
          .send({
            from: this.account.address,
            value: newAmount,
            gasPrice,
            gasLimit: feeRate,
          })
          .then((res) => {
            return this.checkTransaction(res);
          });
      });
  }

  public async sendETHToAuction(amount, ref?) {
    const date = Math.round(
      (new Date().getTime() + 24 * 60 * 60 * 1000) / 1000
    );
    const refLink = ref
      ? ref.toLowerCase()
      : "0x0000000000000000000000000000000000000000".toLowerCase();

    return this.Auction.methods
      .bet(date, refLink)
      .send({
        from: this.account.address,
        value: amount,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  public getUserAuctions() {
    return this.Auction.methods
      .start()
      .call()
      .then((start) => {
        return this.Auction.methods
          .auctionsOf_(this.account.address)
          .call()
          .then((result) => {
            const auctionsPromises = result.map((id) => {
              return this.Auction.methods
                .reservesOf(id)
                .call()
                .then((auctionData) => {
                  const auctionInfo = {
                    auctionId: id,
                    start_date: new Date(
                      (+start + this.settingsApp.settings.time.seconds * id) *
                        1000
                    ),
                    axn_pool: parseFloat(
                      new BigNumber(auctionData.token).toString()
                    ),
                    eth_pool: parseFloat(
                      new BigNumber(auctionData.eth).toString()
                    ),
                    eth_bet: new BigNumber(0),
                    winnings: new BigNumber(0),
                  };
                  return this.Auction.methods
                    .auctionBetOf(id, this.account.address)
                    .call()
                    .then((accountBalance) => {
                      auctionInfo.eth_bet = new BigNumber(accountBalance.eth);
                      // auctionInfo.winnings = ((Number(
                      //   auctionInfo.eth_bet.toString()
                      // ) /
                      //   Number(auctionInfo.eth_pool)) *
                      //   Number(auctionInfo.axn_pool)) as any;

                      auctionInfo.winnings = new BigNumber(
                        auctionInfo.eth_bet
                      ).div(
                        new BigNumber(auctionInfo.eth_pool).multipliedBy(
                          new BigNumber(auctionInfo.axn_pool).toNumber()
                        )
                      );

                      if (
                        accountBalance.ref !==
                        "0x0000000000000000000000000000000000000000"
                      ) {
                        auctionInfo.winnings = new BigNumber(
                          auctionInfo.winnings
                        ).multipliedBy(1.1);
                      }

                      return auctionInfo;
                    });
                });
            });
            return Promise.all(auctionsPromises);
          });
      });
  }

  public withdrawFromAuction(auctionId) {
    return this.Auction.methods
      .withdraw(auctionId)
      .send({
        from: this.account.address,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  public updateUserSnapshot() {
    this.httpService
      .get(`/api/v1/addresses/${this.account.address}/`)
      // .get(`/api/v1/addresses/0x2ec10babc27fd435c62861d95704089eed81e9e6/`)
      .toPromise()
      .then(
        (result) => {
          console.log(result);
          this.account.snapshot = result;
          this.account.snapshot.user_dont_have_hex =
            this.account.snapshot.hex_amount <= 0;
          this.account.snapshot.show_hex =
            new BigNumber(this.account.snapshot.hex_amount).toNumber() > 0
              ? new BigNumber(
                  this.account.snapshot.hex_amount.div(10000000000).toFixed(0)
                )
              : 0;
          // this.account.snapshot.show_hex =
          //   Number(this.account.snapshot.hex_amount) > 0
          //     ? new BigNumber(
          //         (this.account.snapshot.hex_amount / 10000000000).toFixed(0)
          //       )
          //     : 0;
        },
        () => {
          // console.log("none", err);
          this.account.snapshot = {
            user_address: this.account.address,
            user_dont_have_hex: true,
            hex_amount: "0",
            user_hash: "",
            hash_signature: "",
          };
        }
      );
    this.updateClaimableInformationHex();
  }

  private getAccountSnapshot() {
    return new Promise((resolve) => {
      return (
        this.httpService
          .get(`/api/v1/addresses/${this.account.address}/`)
          // .get(`/api/v1/addresses/0x2ec10babc27fd435c62861d95704089eed81e9e6/`)
          .toPromise()
          .then(
            (result) => {
              // console.log(result);
              this.account.snapshot = result;
              this.account.snapshot.user_dont_have_hex =
                this.account.snapshot.hex_amount <= 0;
              this.account.snapshot.show_hex = new BigNumber(
                this.account.snapshot.hex_amount
              )
                .div(10000000000)
                .toNumber();
            },
            () => {
              // console.log("none", err);
              this.account.snapshot = {
                user_address: this.account.address,
                user_dont_have_hex: true,
                hex_amount: "0",
                user_hash: "",
                hash_signature: "",
              };
            }
          )
          .finally(() => {
            resolve();
          })
      );
    });
  }

  public claimFromForeign() {
    return this.ForeignSwapContract.methods
      .claimFromForeign(
        this.account.snapshot.hex_amount,
        this.account.snapshot.hash_signature
      )
      .send({
        from: this.account.address,
      })
      .then((res) => {
        return this.checkTransaction(res);
      });
  }

  private initializeContracts() {
    this.H2TContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.H2T.ABI,
      this.CONTRACTS_PARAMS.H2T.ADDRESS
    );

    this.HEX2XContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.HEX2X.ABI,
      this.CONTRACTS_PARAMS.HEX2X.ADDRESS
    );

    this.NativeSwapContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.NativeSwap.ABI,
      this.CONTRACTS_PARAMS.NativeSwap.ADDRESS
    );

    this.Auction = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.Auction.ABI,
      this.CONTRACTS_PARAMS.Auction.ADDRESS
    );

    this.StakingContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.Staking.ABI,
      this.CONTRACTS_PARAMS.Staking.ADDRESS
    );

    this.HEXContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.HEX.ABI,
      this.CONTRACTS_PARAMS.HEX.ADDRESS
    );

    this.ForeignSwapContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.ForeignSwap.ABI,
      this.CONTRACTS_PARAMS.ForeignSwap.ADDRESS
    );

    this.BPDContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.BPD.ABI,
      this.CONTRACTS_PARAMS.BPD.ADDRESS
    );

    this.SubBalanceContract = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.SubBalance.ABI,
      this.CONTRACTS_PARAMS.SubBalance.ADDRESS
    );

    this.UniswapV2Router02 = this.web3Service.getContract(
      this.CONTRACTS_PARAMS.UniswapV2Router02.ABI,
      this.CONTRACTS_PARAMS.UniswapV2Router02.ADDRESS
    );

    this.AxnTokenAddress = this.CONTRACTS_PARAMS.HEX.ADDRESS;

    this.getEndDateTime();
  }
}
