import { Injectable } from "@angular/core";
import Web3 from "web3";
import { Observable } from "rxjs";
import { WEB3_CONSTANTS } from "./constants";
// import { settingsData } from "../../params";
import { AppConfig } from "src/app/appconfig";

// const IS_PRODUCTION = location.protocol === "https:";

@Injectable({
  providedIn: "root",
})
export class MetamaskService {
  private metaMaskWeb3: any;

  private usedNetworkVersion: number;
  private net: string;
  private IS_PRODUCTION: boolean;

  private networks = {
    production: "mainnet",
    testnet: "rinkeby",
  };

  constructor(private config: AppConfig) {
    const settingsApp = config.getConfig();

    this.networks.testnet = settingsApp.settings.network;

    this.IS_PRODUCTION = settingsApp.settings.production;
    this.usedNetworkVersion = settingsApp.settings.production
      ? 1
      : settingsApp.settings.net;
    this.net =
      this.usedNetworkVersion === 1 ? "mainnet" : settingsApp.settings.network;

    this.providers = {};
    this.providers.metamask = Web3.givenProvider;

    this.metaMaskWeb3 = window["ethereum"];
  }

  private providers;
  public Web3;

  public getContract(abi, address) {
    return new this.Web3.eth.Contract(abi, address);
  }

  public encodeFunctionCall(name, type, inputs, params) {
    return this.Web3.eth.abi.encodeFunctionCall(
      {
        name,
        type,
        inputs,
      },
      params
    );
  }

  public gasPrice() {
    return this.Web3.eth.getGasPrice().then((res) => {
      return res;
    });
  }

  public estimateGas(from, to, value, data, gasPrice) {
    return this.Web3.eth
      .estimateGas({ from, to, value, data, gasPrice })
      .then((res) => {
        return res;
      });
  }

  public async addToken(tokenOptions) {
    try {
      const wasAdded = await this.metaMaskWeb3.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: tokenOptions,
        },
      });

      if (wasAdded) {
        console.log("Complete");
      }
    } catch (error) {
      console.log(error);
    }
  }

  public getBalance(address) {
    return this.Web3.eth.getBalance(address);
  }

  public getBlock() {
    return this.Web3.eth.getBlock("latest");
  }

  public getAccounts(noEnable?) {
    const onAuth = (observer, address) => {
      if (this.Web3) {
        this.Web3.setProvider(this.providers.metamask);
      } else {
        this.Web3 = new Web3(this.providers.metamask);
      }
      observer.next({
        address,
        network: this.net,
      });
      if (noEnable) {
        observer.complete();
      }
    };

    const onError = (observer, errorParams) => {
      // this.Web3.setProvider(this.providers.infura);
      observer.error(errorParams);
      if (noEnable) {
        observer.complete();
      }
    };

    const isValidMetaMaskNetwork = (observer, chain?) => {
      return new Promise((resolve, reject) => {
        this.metaMaskWeb3
          .request({
            method: "net_version",
          })
          .then((result) => {
            if (this.usedNetworkVersion !== Number(result)) {
              if (chain) {
                onError(observer, {
                  code: 3,
                  msg: "Not authorized",
                });
              }

              observer.error({
                code: 2,
                msg: "Please choose " + this.net + " network in Metamask.",
              });
              reject();
            }
            resolve();
          });
      });
    };

    return new Observable((observer) => {
      if (this.metaMaskWeb3 && this.metaMaskWeb3.isMetaMask) {
        this.metaMaskWeb3.on("chainChanged", (chainId) => {
          isValidMetaMaskNetwork(observer)
            .then(() => {
              // onAuth(observer, this.metaMaskWeb3.selectedAddress);
              window.location.reload();
            })
            .catch((err) => {
              console.log(err);
              onError(observer, {
                code: 3,
                msg: "Not authorized",
              });
            });
        });

        isValidMetaMaskNetwork(observer).then(() => {
          this.metaMaskWeb3.on("accountsChanged", (accounts) => {
            if (accounts.length) {
              onAuth(observer, accounts[0]);
            } else {
              onError(observer, {
                code: 3,
                msg: "Not authorized",
              });
            }
          });

          if (!this.metaMaskWeb3.selectedAddress && !noEnable) {
            this.metaMaskWeb3.enable().catch(() => {
              onError(observer, {
                code: 3,
                msg: "Not authorized",
              });
            });
          } else {
            if (this.metaMaskWeb3.selectedAddress) {
              onAuth(observer, this.metaMaskWeb3.selectedAddress);
            } else {
              onError(observer, {
                code: 3,
                msg: "Not authorized",
              });
            }
          }
        });
      } else {
        onError(observer, {
          code: 1,
          msg:
            'Metamask extension is not found. You can install it from <a href="https://metamask.io" target="_blank">metamask.io</a>',
        });
      }
      return {
        unsubscribe() {},
      };
    });
  }
}
