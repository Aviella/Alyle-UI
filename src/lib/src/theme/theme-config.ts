import { InjectionToken } from '@angular/core';
import { LyStyleUtils, Dir } from '../style-utils';
import { RippleVariables } from './variables/ripple';
import { TypographyVariables } from './variables/typography';
import { TooltipVariables } from './variables/tooltip';
import { ImgCropperVariables } from './variables/img-cropper';
import { SelectVariables } from './variables/select';
import { TabsVariables } from './variables/tabs';
import { ToolbarVariables } from './variables/toolbar';
import { Color } from '@alyle/ui/color';

export const LY_THEME_GLOBAL_VARIABLES = new InjectionToken<PartialThemeVariables>('ly.theme.global.variables');
export const LY_THEME = new InjectionToken<ThemeConfig | ThemeConfig[]>('ly_theme_config');
export const LY_THEME_NAME = new InjectionToken<string>('ly.theme.name');

export interface ThemeConfig {
  name: string;
  primary: DefaultVal & PaletteColor;
  accent: DefaultVal & PaletteColor;
  warn: DefaultVal & PaletteColor;
  disabled: {
    default: Color
    contrast: Color
  };
  paper: DefaultVal & PaletteColor;
  background: {
    /** secondary */
    default: Color
    primary: DefaultVal & PaletteColor
    secondary: Color
    tertiary: Color
  };
  hover: Color;
  text: {
    default: Color
    primary: Color
    secondary: Color
    disabled: Color
    hint: Color
    /** When a contrast is needed for a dark background */
    light: Color
    /** When a contrast is needed for a light background */
    dark: Color
  };
  typography?: TypographyVariables;
  /** color for divider */
  divider: Color;
  shadow: Color;
  drawer: {
    /** color for drawer:backdrop */
    backdrop: Color
  };
  iconButton: {
    size: string
  };
  icon: {
    fontSize: string
  };
  zIndex: {
    toolbar: number
    drawer: number
    overlay: number
    [key: string]: number
  };
  direction?: Dir;
  animations: {
    curves: {
      standard: string
      deceleration: string
      acceleration: string
      sharp: string
    },
    durations: {
      complex: number
      entering: number
      exiting: number
    }
  };
  ripple: RippleVariables;
  tooltip: TooltipVariables;
  imgCropper?: ImgCropperVariables;
  select?: SelectVariables;
  tabs?: TabsVariables;
  toolbar?: ToolbarVariables;
}

export type ThemeVariables = LyStyleUtils & ThemeConfig;
export type PartialThemeVariables = RecursivePartial<ThemeVariables>;

export interface DefaultVal {
  default: Color;
}
export interface PaletteColor {
  contrast?: Color;
  /** shadow color */
  shadow?: Color;
}

type primitive = string | number | boolean | undefined | null;
type RecursivePartialObject<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};
export type RecursivePartial<T> = T extends primitive ? T : RecursivePartialObject<T>;

