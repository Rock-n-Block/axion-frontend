import { Injectable } from "@angular/core";
import Web3 from "web3";
import { Observable } from "rxjs";
import { WEB3_CONSTANTS } from "./constants";
// const IS_PRODUCTION = location.protocol === "https:";
const IS_PRODUCTION = false;

const networks = {
  production: "mainnet",
  testnet: "rinkeby",
};

const usedNetworkVersion = IS_PRODUCTION ? 1 : 4;
const net = usedNetworkVersion === 1 ? "mainnet" : "rinkeby";

@Injectable({
  providedIn: "root",
})
export class MetamaskService {
  private metaMaskWeb3: any;

  constructor() {
    this.providers = {};
    this.providers.metamask = Web3.givenProvider;
    this.providers.infura = new Web3.providers.HttpProvider(
      WEB3_CONSTANTS[
        networks[IS_PRODUCTION ? "mainnet" : "testnet"]
      ].WEB3_PROVIDER
    );

    this.metaMaskWeb3 = window["ethereum"];
    this.Web3 = new Web3(this.providers.infura);
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

  public getBalance(address) {
    return this.Web3.eth.getBalance(address);
  }

  public getBlock() {
    return this.Web3.eth.getBlock("latest");
  }

  public getAccounts(noEnable?) {
    const isValidMetaMaskNetwork = (observer) => {
      return new Promise((resolve, reject) => {
        this.metaMaskWeb3
          .request({
            method: "net_version",
          })
          .then((result) => {
            if (usedNetworkVersion !== Number(result)) {
              observer.error({
                code: 2,
                msg: "Please choose " + net + " network in Metamask.",
              });
              reject();
            }
            resolve();
          });
      });
    };

    const onAuth = (observer, address) => {
      this.Web3.setProvider(this.providers.metamask);
      observer.next({
        address,
        network: net,
      });
      if (noEnable) {
        observer.complete();
      }
    };

    const onError = (observer, errorParams) => {
      this.Web3.setProvider(this.providers.infura);
      observer.error(errorParams);
      if (noEnable) {
        observer.complete();
      }
    };

    return new Observable((observer) => {
      if (this.metaMaskWeb3 && this.metaMaskWeb3.isMetaMask) {
        isValidMetaMaskNetwork(observer).then((res) => {
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
