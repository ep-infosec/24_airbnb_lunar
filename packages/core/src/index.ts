import aesthetic, { Direction, FontFace } from 'aesthetic';
import AphroditeAdapter from 'aesthetic-adapter-aphrodite';
import { Settings as LuxonSettings } from 'luxon';
import { Path as EmojiPath } from 'interweave-emoji';
import globalStyles from './themes/global';
import lightTheme from './themes/light';
import darkTheme from './themes/dark';
import getLocaleFromClient from './utils/getLocaleFromClient';
import getTimezoneFromClient from './utils/getTimezoneFromClient';
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from './constants';
import {
  Locale,
  TimeZone,
  Logger,
  Translator,
  TranslateParams,
  TranslateProps,
  TranslateOptions,
} from './types';

export * from './types';

export type Settings = {
  defaultLocale?: Locale;
  defaultTimezone?: TimeZone;
  emojiCDN?: EmojiPath;
  errorURL?: string;
  traceURL?: string;
  fontFaces?: { [fontFamily: string]: FontFace[] };
  fontFamily?: string;
  logger?: Logger | null;
  name: string;
  rtl?: boolean;
  theme?: string;
  translator?: Translator | null;
  translatorComponent?: React.ComponentType<TranslateProps> | null;
};

class Core {
  settings: Required<Settings> = {
    defaultLocale: getLocaleFromClient() || DEFAULT_LOCALE,
    defaultTimezone: getTimezoneFromClient() || DEFAULT_TIMEZONE,
    emojiCDN: '',
    errorURL: '',
    traceURL: '',
    fontFaces: {},
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    logger: null,
    name: 'Lunar',
    rtl: false,
    theme: 'light',
    translator: null,
    translatorComponent: null,
  };

  readonly aesthetic = aesthetic;

  initialize(settings: Settings) {
    this.settings = {
      ...this.settings,
      ...settings,
    };

    this.bootstrapAesthetic();
    this.bootstrapLuxon();
  }

  bootstrapAesthetic() {
    const { fontFaces, rtl, theme } = this.settings;
    const fontFamily = this.fontFamily();
    const globals = globalStyles(fontFaces);

    try {
      aesthetic
        .registerTheme('light', lightTheme(fontFamily), globals)
        .registerTheme('dark', darkTheme(fontFamily), globals)

        // Aesthetic's ThemeContext default theme is "default",
        // so let's register a default theme based on light
        // so that downstream consumers don't break.
        .extendTheme('default', 'light', {});
    } catch {
      // Tests trigger an error, so ignore it
    }

    if (process.env.NODE_ENV === 'test') {
      // eslint-disable-next-line
      const { TestAdapter } = require('aesthetic/lib/testing');

      aesthetic.configure({
        // eslint-disable-next-line
        adapter: new TestAdapter(),
        extendable: true,
        theme: 'light',
      });
    } else {
      aesthetic.configure({
        adapter: new AphroditeAdapter(),
        extendable: true,
        rtl,
        theme,
      });
    }
  }

  bootstrapLuxon() {
    LuxonSettings.defaultLocale = this.locale();
    LuxonSettings.defaultZoneName = this.timezone();
    LuxonSettings.throwOnInvalid = true;
  }

  fontFamily(): string {
    const locale = this.locale();

    if (locale.startsWith('ja')) {
      return '"?????????????????? Pro", "Hiragino Kaku Gothic Pro", ????????????, Meiryo, Osaka, "?????? ???????????????", "MS PGothic", "MS Gothic", "?????? ????????????", "Helvetica Neue", Helvetica, Arial, sans-serif';
    }

    if (locale.startsWith('ko')) {
      return '"?????? ??????", "Nanum Gothic", "?????? ??????", "Malgun Gothic", "Apple Gothic", ??????, Dotum, "Helvetica Neue", Helvetica, Arial, sans-serif';
    }

    if (locale.includes('zh')) {
      return '"Hiragino Sans GB", ????????????, STHeiti, ????????????, "Microsoft YaHei", SimHei, "Helvetica Neue", Helvetica, Arial, sans-serif';
    }

    return this.settings.fontFamily;
  }

  isRTL(context?: Direction): boolean {
    if (context && context !== 'neutral') {
      return context === 'rtl';
    }

    // If undefined or neutral, fallback to the global setting
    return this.settings.rtl;
  }

  locale(): Locale {
    return this.settings.defaultLocale || DEFAULT_LOCALE;
  }

  log = (error: Error, extra: object) => {
    const { logger } = this.settings;

    if (logger) {
      logger(error, extra);
    }
  };

  timezone(): TimeZone {
    return this.settings.defaultTimezone || DEFAULT_TIMEZONE;
  }

  translate = (
    key: string,
    phrase: string,
    params: TranslateParams = {},
    options: TranslateOptions = {},
  ) => {
    const { translator } = this.settings;

    if (translator) {
      return translator(key, phrase, params, options);
    }

    let message = phrase;

    if (phrase.includes('||||')) {
      const [singular, plural] = phrase.split('||||');
      const count = params.smartCount || 0;

      message = count === 1 ? singular : plural;
    }

    // Low-level token interpolation
    return message.replace(/%{(\w+)}/g, (match, k) => `${params[String(k)]}`);
  };
}

export default new Core();
