import { async } from "@angular/core/testing";
import { registerLocaleData } from "@angular/common";
import { Injectable } from "@angular/core";
import { isNullOrUndefined } from "util";

function _window(): any {
  return window;
}

@Injectable()
export class LocaleService {
  private _locale: string;
  private _localeBase = "en";

  set locale(value: string) {
    this._locale = value;
  }
  get locale(): string {
    return this._locale || "en-US";
  }
  get nativeWindow(): any {
    return _window();
  }

  constructor() {
    try {
      if (
        !isNullOrUndefined(this.nativeWindow.navigator.language) &&
        this.nativeWindow.navigator.language !== ""
      ) {
        this._localeBase = this.nativeWindow.navigator.language;
      }
    } finally {
    }
    this.registerCulture(this._localeBase);
    // this.registerCulture("zh-hk"); // test, will show 2020/10/20
    // this.registerCulture("en"); // test, will show 20/10/20
    // this.registerCulture("ru-RU"); // test, will show 20.10.2020
  }

  public async registerCulture(culture: string) {
    // console.log("culture", culture);

    if (!culture) {
      return;
    }

    switch (culture.toLowerCase()) {
      case "en-uk": {
        this._locale = "en";
        // console.log("Application Culture Set to English");
        break;
      }
      case "zh-hk": {
        this._locale = "zh-Hant";
        // console.log("Application Culture Set to Traditional Chinese");
        break;
      }
      case "ru-ru": {
        this._locale = "ru";
        // console.log("Application Culture Set to Russian");
        break;
      }
      default: {
        this._locale = "en";
        // console.log("Application Culture Set to default - English");
        break;
      }
    }

    await import(`@angular/common/locales/${this._locale}.js`).then(
      (locale) => {
        console.log(this._locale, locale);
        registerLocaleData(locale.default);
      }
    );
  }
}
