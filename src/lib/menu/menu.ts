import {
  AfterViewInit,
  Component,
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  Renderer2,
  TemplateRef,
  ViewChild,
  Output,
  EventEmitter,
  OnChanges,
  ContentChildren,
  forwardRef,
  QueryList,
  HostBinding,
  AfterContentInit
  } from '@angular/core';
import {
  LyOverlay,
  LyTheme2,
  OverlayFactory,
  Placement,
  Positioning,
  shadowBuilder,
  ThemeVariables,
  XPosition,
  YPosition,
  StyleCollection,
  LyClasses,
  StyleTemplate,
  lyl,
  ThemeRef,
  LyOverlayPosition,
  StyleRenderer,
  OverlayReference
  } from '@alyle/ui';
import {
  trigger,
  style,
  animate,
  transition,
  AnimationEvent,
  group
} from '@angular/animations';
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { ViewportRuler } from '@angular/cdk/scrolling';
import { Subject, asapScheduler } from 'rxjs';
import { take, delay, debounceTime } from 'rxjs/operators';
import { ESCAPE } from '@angular/cdk/keycodes';
import { FocusKeyManager, FocusMonitor, FocusOrigin} from '@angular/cdk/a11y';

/** Reason why the menu was closed. */
export type MenuCloseReason = void | 'click' | 'keydown' | 'tab';

export interface LyMenuTheme {
  /** Styles for Menu Component */
  root?: StyleCollection<((classes: LyClasses<typeof STYLES>) => StyleTemplate)>
    | ((classes: LyClasses<typeof STYLES>) => StyleTemplate);
}

export interface LyMenuVariables {
  menu?: LyMenuTheme;
}

const STYLE_PRIORITY = -1;

export const STYLES = (theme: ThemeVariables & LyMenuVariables, ref: ThemeRef) => {
  const menu = ref.selectorsOf(STYLES);
  const { after } = theme;
  return {
    $name: LyMenu.и,
    $priority: STYLE_PRIORITY,
    root: () => (
      theme.menu?.root
        && (theme.menu.root instanceof StyleCollection
          ? theme.menu.root.setTransformer(fn => fn(menu)).css
          : theme.menu.root(menu))
    ),
    container: lyl `{
      background: ${theme.paper.default}
      border-radius: 2px
      box-shadow: ${shadowBuilder(4)}
      display: block
      padding-top: 8px
      padding-bottom: 8px
      transform-origin: inherit
      pointer-events: all
      overflow: auto
      max-height: inherit
      max-width: inherit
      box-sizing: border-box
    }`,
    item: lyl `{
      display: flex
      min-height: 48px
      border-radius: 0
      width: 100%
      justify-content: flex-start
      font-weight: 400
      ly-icon {
        margin-${after}: 16px
      }
    }`,
    itemSubMenuTrigger: () => lyl `{
      padding-${after}: 32px
      &::after {
        width: 0
        height: 0
        border-style: solid
        border-width: 5px 0 5px 5px
        border-color: transparent transparent transparent currentColor
        content: ""
        display: inline-block
        position: absolute
        top: 50%
        ${after}: 16px
        transform: translateY(-50%)
      }
    }`
  };
};

const ANIMATIONS = [
  trigger('transformMenu', [
    transition('void => enter', group([
      style({
        opacity: 0,
        transform: 'scale(0.8)'
      }),
      animate('100ms linear', style({
        opacity: 1
      })),
      animate('120ms cubic-bezier(0, 0, 0.2, 1)', style({transform: 'scale(1)'})),
    ]))
  ]),
  trigger('transformMenuLeave', [
    transition('* => void', animate('100ms 25ms linear', style({ opacity: 0 })))
  ])
];

/** Menu container */
@Component({
  selector: 'ly-menu',
  animations: [...ANIMATIONS],
  templateUrl: 'menu.html',
  exportAs: 'lyMenu',
  providers: [
    StyleRenderer
  ]
})
export class LyMenu implements OnChanges, OnInit, AfterContentInit, AfterViewInit, OnDestroy {

  private _keyManager: FocusKeyManager<LyMenuItem>;
  /** Menu Trigger */
  @Input()
  set ref(value: LyMenuTriggerFor) {
    this._ref = value;
    this._menuRef = value._menuRef!;
  }
  get ref() {
    return this._ref;
  }

  /** Whether the menu has a backdrop. */
  @Input()
  get hasBackdrop(): boolean {
    return this._hasBackdrop;
  }
  set hasBackdrop(value: boolean) {
    this._hasBackdrop = coerceBooleanProperty(value);
  }

  constructor(
    private _theme: LyTheme2,
    private _el: ElementRef,
    private _renderer: Renderer2,
    private _viewportRuler: ViewportRuler,
    readonly sRenderer: StyleRenderer
  ) { }

  /** @docs-private */
  static readonly и = 'LyMenu';


  static ngAcceptInputType_hasBackdrop: BooleanInput;

  /**
   * styles
   * @docs-private
   */
  readonly classes = this.sRenderer.renderSheet(STYLES, true);

  /** Whether the menu is animating. */
  _isAnimating: boolean;

  /** Whether the menu is destroying. */
  _isDestroying: boolean;

  /** Emits whenever an animation on the menu completes. */
  _animationDone = new Subject<AnimationEvent>();

  private _menuRef: OverlayFactory<any>;
  /**
   * Destroy menu
   * @docs-private
   */
  destroy: () => void;

  @ViewChild('container') _container?: ElementRef<HTMLDivElement>;
  /** All items inside the menu. Includes items nested inside another menu. */
  @ContentChildren(forwardRef(() => LyMenuItem), {descendants: true}) readonly _allItems: QueryList<LyMenuItem>;
  /** Only the direct descendant menu items. */
  _directDescendantItems = new QueryList<LyMenuItem>();

  private _ref: LyMenuTriggerFor;

  /** The point in the anchor where the menu `xAxis` will be attached. */
  @Input() xAnchor: XPosition;

  /** The point in the anchor where the menu `yAxis` will be attached. */
  @Input() yAnchor: YPosition;

  /** The x-axis position of the menu. */
  @Input() xAxis: XPosition;

  /** The y-axis position of the menu. */
  @Input() yAxis: YPosition;

  /**
   * Position where the menu will be placed.
   * @deprecated Use `xAxis` and` yAxis` together instead.
   */
  @Input() placement: Placement;


  /**
   * The x-axis position of the menu.
   * @deprecated Use `xAxis` instead.
   */
  @Input() xPosition: XPosition;

  /**
   * The y-axis position of the menu.
   * @deprecated Use `yAxis` instead.
   */
  @Input() yPosition: YPosition;

  @Input()
  set flip(val: BooleanInput) {
    const newValue = coerceBooleanProperty(val);
    this._flip = newValue;
  }
  get flip(): boolean {
    return this._flip;
  }
  private _flip = true;

  /** Event emitted when the menu is closed. */
  @Output() readonly closed: EventEmitter<MenuCloseReason> = new EventEmitter<MenuCloseReason>();


  private _hasBackdrop: boolean = true;
  private _mouseenterListen?: () => void;
  private _mouseleaveListen?: () => void;

  @HostBinding('@transformMenuLeave') transformMenuLeave: unknown;

  ngOnChanges() {
    if (this.ref?._menuRef && this._container) {
      // Update backdrop
      this.ref._menuRef.updateBackdrop(this.ref._isItemSubMenuTrigger() ? false : this.hasBackdrop);
      this._updatePlacement();
      this._checkBackdropAndOpenOnHover();
    }
  }

  ngOnInit() {
    if (!this.ref) {
      throw new Error('LyMenu: require @Input() ref');
    }
  }

  ngAfterContentInit() {
    this._keyManager = new FocusKeyManager(this._directDescendantItems)
      .withWrap()
      .withTypeAhead()
      .withHomeAndEnd();
    this._keyManager.tabOut.subscribe(() => this.closed.emit('tab'));
  }

  ngAfterViewInit() {
    if (this.ref._menuRef) {
      this.ref._menuRef.onResizeScroll = this._updatePlacement.bind(this);
      this.ref._menuRef.updateBackdrop(this.ref._isItemSubMenuTrigger() ? false : this.hasBackdrop);
      this._checkBackdropAndOpenOnHover();
    }
    this._updatePlacement();
    this.ref.menuOpened.emit();
    Promise.resolve(null).then(() => {
      this.ref._setMenuOpenToTrue();
    });
    const hostTrigger = this._getHostMenuTrigger();
    hostTrigger._menuDetached
      .pipe(take(1))
      .subscribe(() => this._ref.closeMenu());
    this._addOpenOnHover();
  }

  ngOnDestroy() {
    this._removeOpenOnHoverListeners();
    this._directDescendantItems.destroy();
  }

  private _checkBackdropAndOpenOnHover() {
    const hostTrigger = this._getHostMenuTrigger();
    if (this.hasBackdrop && hostTrigger._menuOpenOnHoverRef?.openOnHover) {
      throw new Error(`${LyMenu.и}: Can't use [hasBackdrop] with [openOnHover] at the same time, set [hasBackdrop] to false to use [openOnHover]`);
    }
  }

  private _getHostMenuTrigger() {
    let menuTrigger = this.ref;

    while (menuTrigger._menu?.ref) {
      menuTrigger = menuTrigger._menu.ref;
    }

    return menuTrigger;
  }

  private _addOpenOnHover() {
    const hostTrigger = this._getHostMenuTrigger();
    if (hostTrigger._menuOpenOnHoverRef?.openOnHover && !this._mouseenterListen && !this._mouseleaveListen) {
      hostTrigger._menuOpenOnHoverRef!._handleMouseEnterOrLeave(true);
      this._mouseenterListen = this._renderer
        .listen(
          this._el.nativeElement,
          'mouseenter',
          () => hostTrigger._menuOpenOnHoverRef!._handleMouseEnterOrLeave(true)
        );

      this._mouseleaveListen = this._renderer
        .listen(
          this._el.nativeElement,
          'mouseleave',
          () => hostTrigger._menuOpenOnHoverRef!._handleMouseEnterOrLeave(false)
        );
    }
  }

  /** Remove listeners */
  private _removeOpenOnHoverListeners() {
    if (this._mouseenterListen) {
      this._mouseenterListen();
    }
    if (this._mouseleaveListen) {
      this._mouseleaveListen();
    }
  }

  /** Update Menu Position */
  private _updatePlacement() {
    const el = this.ref._menuRef?.containerElement;
    const container = this._container?.nativeElement;

    // Do not update when not available
    if (!el || !container) {
      return;
    }

    // reset height & width
    this._renderer.setStyle(container, 'height', 'initial');
    this._renderer.setStyle(container, 'width', 'initial');

    const position = this.placement
      ? new Positioning(this.placement, this.xPosition, this.yPosition, this.ref._getHostElement(), el, this._theme.variables)
      : !this.ref._isItemSubMenuTrigger()
        ? new LyOverlayPosition(this._theme, this._viewportRuler, this.ref._getHostElement(), el)
          .setXAnchor(this.xAnchor)
          .setYAnchor(this.yAnchor)
          .setXAxis(this.xAxis)
          .setYAxis(this.yAxis)
          .setFlip(this.flip)
          .build()
        : new LyOverlayPosition(this._theme, this._viewportRuler, this.ref._getHostElement(), el)
          .setXAnchor(XPosition.after)
          .setYAnchor(YPosition.above)
          .setFlip(this.flip)
          .build();

    if (position instanceof Positioning) {
      // set position deprecated
      this._renderer.setStyle(el, 'transform', `translate3d(${position.x}px, ${position.y}px, 0)`);
      this._renderer.setStyle(this._el.nativeElement, 'transform-origin', `${position.ox} ${position.oy} 0`);

      // set height & width deprecated
      this._renderer.setStyle(container, 'height', position.height === 'initial' ? '100%' : position.height);
      this._renderer.setStyle(container, 'width', position.width === 'initial' ? '100%' : position.width);
    } else {
      // set position
      this._renderer.setStyle(el, 'left', `${position.x}px`);
      this._renderer.setStyle(el, 'top', `${position.y}px`);
      this._renderer.setStyle(container, 'width', position.width ? `${position.width}px` : '100%');
      this._renderer.setStyle(container, 'height', position.height ? `${position.height}px` : '100%');
      this._renderer.setStyle(this._el.nativeElement, 'transform-origin', `${position.xo}px ${position.yo}px 0`);
    }

  }
  @HostListener('@transformMenuLeave.start', ['$event']) _onAnimationStart(event: AnimationEvent) {
    this._isAnimating = true;
    if (event.triggerName === 'transformMenuLeave' && event.toState === 'void') {
      this._isDestroying = true;
    }
  }
  @HostListener('@transformMenuLeave.done', ['$event']) _onAnimationDone(event: AnimationEvent) {
    this._animationDone.next(event);
    this._isAnimating = false;
    if (event.toState === 'void' && event.triggerName === 'transformMenuLeave') {
      this.ref.destroy(this._menuRef);
    }
  }
}

@Directive({
  selector: '[ly-menu-item]',
  host: {
    '(click)': '_handleClick()',
    '(mouseenter)': '_handleMouseEnter()'
  }
})
export class LyMenuItem implements OnDestroy {
  private _itemSubMenuTrigger?: LyMenuTriggerFor;
  /** Stream that emits when the menu item is focused. */
  readonly _focused = new Subject<LyMenuItem>();

  constructor(
    @Optional() private _menu: LyMenu,
    private _el: ElementRef,
    renderer: Renderer2,
    private _focusMonitor: FocusMonitor,
  ) {
    renderer.addClass(_el.nativeElement, _menu.classes.item);
  }

  ngOnDestroy(): void {
    this._focused.complete();
  }
  /** Focuses the menu item. */
  focus(origin?: FocusOrigin, options?: FocusOptions): void {
    if (this._focusMonitor && origin) {
      this._focusMonitor.focusVia(this._getHostElement(), origin, options);
    } else {
      this._getHostElement().focus(options);
    }

    this._focused.next(this);
  }

  _handleClick() {
    if (this._menu.ref && this._menu.ref._menuRef) {
      if (!this._getItemSubMenuTrigger()) {
        let currentTrigger = this._menu.ref;
        while (currentTrigger) {
          currentTrigger.closeMenu();
          currentTrigger = currentTrigger._menu?.ref;
        }
      }
    }
  }

  _handleMouseEnter() {
    const itemSubMenuTrigger = this._getItemSubMenuTrigger();
    if (itemSubMenuTrigger && !this._menu._isDestroying) {
      if (this._menu._isAnimating) {
        this._menu._animationDone
        .pipe(take(1), delay(0, asapScheduler))
        .subscribe(() => {
          itemSubMenuTrigger.openMenu();
          this._closeOtherMenus();
        });
      } else {
        itemSubMenuTrigger.openMenu();
        this._closeOtherMenus();
      }
    } else {
      this._closeOtherMenus();
    }
  }

  /** Except for this, close all menus */
  private _closeOtherMenus() {
    this._menu._allItems!.forEach(menuItem => {
      if (menuItem !== this) {
        menuItem._getItemSubMenuTrigger()?.closeMenu();
      }
    });
  }

  _setItemSubMenuTrigger(menuTrigger: LyMenuTriggerFor) {
    this._itemSubMenuTrigger = menuTrigger;
  }
  _getItemSubMenuTrigger() {
    return this._itemSubMenuTrigger;
  }

  /** Returns the host DOM element. */
  _getHostElement(): HTMLElement {
    return this._el.nativeElement;
  }

}


@Directive({
  selector: '[lyMenuTriggerFor]',
  host: {
    '(click)': '_handleClick()'
  },
  exportAs: 'lyMenuTriggerFor',
  providers: [
    StyleRenderer
  ]
})
export class LyMenuTriggerFor implements OnDestroy {
  readonly classes = this.sRenderer.renderSheet(STYLES);

  /** Current menuRef */
  _menuRef?: OverlayFactory | null;
  private _menuOpen = false;
  private _destroying: boolean;
  _menuDetached = new Subject<void>();
  _menuOpenOnHoverRef?: LyMenuOpenOnHover;

  /** Whether the menu is open. */
  get menuOpen() {
    return this._menuOpen;
  }

  @Input() lyMenuTriggerFor: TemplateRef<any>;

  /** Data to be passed to the menu. */
  @Input('lyMenuTriggerData') menuData: any;

  @Output() readonly menuOpened = new EventEmitter<void>();
  @Output() readonly menuClosed = new EventEmitter<void>();

  constructor(
    private elementRef: ElementRef,
    private overlay: LyOverlay,
    @Optional() private _menuItem: LyMenuItem,
    readonly sRenderer: StyleRenderer,
    @Optional() public _menu: LyMenu
  ) {
    if (this._isItemSubMenuTrigger()) {
      _menuItem._setItemSubMenuTrigger(this);
      sRenderer.addClass(this.classes.itemSubMenuTrigger);
    }
  }

  ngOnDestroy() {
    // Not force destruction if it is already being destroyed
    if (!this._destroying) {
      this.closeMenu();
    }
    this._menuDetached.complete();
  }

  _handleClick() {
    if (!this._isItemSubMenuTrigger()) {
      this.toggleMenu();
    }
  }

  /** Opens the menu */
  openMenu() {
    if (!this._menuRef) {
      const overlayRef = this.overlay.create(this.lyMenuTriggerFor, {
        $implicit: this,
        data: this.menuData
      }, {
        styles: {
          top: 0,
          left: 0,
          pointerEvents: null
        },
        fnDestroy: this.detach.bind(this),
        hasBackdrop: false
      });
      this._menuRef = overlayRef;
      const keydownEvents = overlayRef.keydownEvents();
      const keydownEventsSuscription = keydownEvents.subscribe((event) => {
        if (event.keyCode === ESCAPE) {
          this.closeMenu();
          keydownEventsSuscription.unsubscribe();
        }
      });
    }
  }

  /** Closes the menu */
  closeMenu() {
    this.detach();
  }

  /** Toggle menu */
  toggleMenu() {
    if (this._menuRef) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  /** @docs-private */
  detach() {
    const menuRef = this._menuRef;
    if (menuRef) {
      this._closeOverlay(menuRef);
      this._menuRef = null;
      this._destroying = true;
      this._menuDetached.next();
    }
  }

  /** @docs-private */
  destroy(menuRef: OverlayFactory<any>) {
    this.menuClosed.emit(null!);
    menuRef.remove();
    this._destroying = false;
    Promise.resolve(null).then(() => this._menuOpen = false);
  }

  _getHostElement() {
    return this.elementRef.nativeElement;
  }

  _setMenuOpenToTrue() {
    this._menuOpen = true;
  }

  /**
   * @docs-private
   */
  _isItemSubMenuTrigger() {
    return !!this._menuItem;
  }

  private _closeOverlay(overlay?: OverlayReference | null) {
    const overlayRef = overlay;
    if (overlayRef && !overlay.isDestroyed) {
      overlayRef.detach();
    }
  }

}

@Directive({
  selector: '[lyMenuTriggerFor][openOnHover]',
  host: {
    '(mouseenter)': '_handleMouseEnterOrLeave(true)',
    '(mouseleave)': '_handleMouseEnterOrLeave(false)'
  }
})
export class LyMenuOpenOnHover implements OnDestroy {

  private _events = new Subject<boolean>();

  /** Whether menu should open on hover. */
  @Input()
  get openOnHover(): boolean {
    return this._openOnHover;
  }
  set openOnHover(value: boolean) {
    this._openOnHover = coerceBooleanProperty(value);
    Promise.resolve(null)
    .then(() => this._openOnHover
      ? this._trigger._menuOpenOnHoverRef = this
      : delete this._trigger._menuOpenOnHoverRef);
  }
  private _openOnHover: boolean = true;

  constructor(
    private _trigger: LyMenuTriggerFor
  ) {
    _trigger._menuOpenOnHoverRef = this;
    this._events
      .pipe(
        debounceTime(200)
      )
      .subscribe(enterOrLeave => {
        if (this.openOnHover) {
          if (enterOrLeave) {
            _trigger.openMenu();
          } else {
            _trigger.closeMenu();
          }
        }
      });
  }

  ngOnDestroy() {
    this._events.complete();
  }

  /** Handle mouseenter */
  _handleMouseEnterOrLeave(enter: true): void;
  /** Handle mouseleave */
  _handleMouseEnterOrLeave(leave: false): void;
  /** Handle mouseenter or mouseleave */
  _handleMouseEnterOrLeave(leaveOrEnter: boolean): void {
    if (this.openOnHover) {
      if (leaveOrEnter) {
        this._trigger.openMenu();
      }
      this._events.next(leaveOrEnter);
    }
  }
}
