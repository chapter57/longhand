#import "AppController.h"
#import "AudioEngine.h"
#import "Library.h"
#import "TrackLoader.h"
#import "VolumeHelper.h"
#include <stdlib.h>
#include <time.h>

// ---- small helpers ---------------------------------------------------------

static NSString *U(const char *utf8) { return [NSString stringWithUTF8String:utf8]; }

static NSString *FormatTime(double s)
{
    if (s < 0) s = 0;
    long t = (long)s;
    return [NSString stringWithFormat:@"%ld:%02ld", t / 60, t % 60];
}

static NSString *ArrowKey(unichar c) { return [NSString stringWithFormat:@"%C", c]; }

static NSFont *MonoFont(CGFloat size)
{
    NSFont *f = [NSFont fontWithName:@"Monaco" size:size];
    return f ? f : [NSFont userFixedPitchFontOfSize:size];
}

static NSColor *LCDGreen(void) { return [NSColor colorWithCalibratedRed:0.35 green:1.0 blue:0.35 alpha:1.0]; }
static NSColor *LCDDim(void)   { return [NSColor colorWithCalibratedRed:0.25 green:0.70 blue:0.25 alpha:1.0]; }

static void StyleLabel(NSTextField *f, NSFont *font, NSColor *color)
{
    [f setBezeled:NO];
    [f setBordered:NO];
    [f setDrawsBackground:NO];
    [f setEditable:NO];
    [f setSelectable:NO];
    [f setFont:font];
    [f setTextColor:color];
    [[f cell] setLineBreakMode:NSLineBreakByTruncatingTail];
}

static NSTextField *MakeLabel(NSRect frame, NSFont *font, NSColor *color)
{
    NSTextField *f = [[[NSTextField alloc] initWithFrame:frame] autorelease];
    StyleLabel(f, font, color);
    return f;
}

static NSSortDescriptor *SortBy(NSString *key, SEL sel)
{
    return [[[NSSortDescriptor alloc] initWithKey:key ascending:YES selector:sel] autorelease];
}

static NSString *PathOf(NSDictionary *t) { return [t objectForKey:@"path"]; }

static BOOL SameTrack(NSDictionary *a, NSDictionary *b)
{
    return a && b && [PathOf(a) isEqualToString:PathOf(b)];
}

// ---- custom views ----------------------------------------------------------

// The black "LCD" panel at the top of the window.
@interface DisplayView : NSView
@end

@implementation DisplayView
- (void)drawRect:(NSRect)rect
{
    [[NSColor colorWithCalibratedWhite:0.07 alpha:1.0] set];
    [[NSBezierPath bezierPathWithRoundedRect:[self bounds] xRadius:6 yRadius:6] fill];
}
@end

// The time readout: click it to switch between elapsed and remaining.
@interface TimeField : NSTextField
@end

@implementation TimeField
- (void)mouseDown:(NSEvent *)e { [self sendAction:[self action] to:[self target]]; }
@end

// The playlist. Adds the Winamp keys: z x c v b, space, return, arrows.
@interface PlayerTableView : NSTableView {
    id controller;
}
- (void)setController:(id)c;
@end

@implementation PlayerTableView
- (void)setController:(id)c { controller = c; }

- (void)keyDown:(NSEvent *)e
{
    NSString *chars = [e charactersIgnoringModifiers];
    NSUInteger mods = [e modifierFlags] & (NSCommandKeyMask | NSControlKeyMask | NSAlternateKeyMask);
    if (mods == 0 && [chars length] == 1) {
        SEL action = NULL;
        switch ([chars characterAtIndex:0]) {
            case 'z': case 'Z': action = @selector(previous:); break;
            case 'x': case 'X': action = @selector(play:); break;
            case 'c': case 'C': action = @selector(pause:); break;
            case 'v': case 'V': action = @selector(stopPlayback:); break;
            case 'b': case 'B': action = @selector(next:); break;
            case ' ':           action = @selector(pause:); break;
            case '\r': case 3:  action = @selector(playSelected:); break;
            case NSLeftArrowFunctionKey:  action = @selector(seekBack:); break;
            case NSRightArrowFunctionKey: action = @selector(seekForward:); break;
        }
        if (action) {
            [controller performSelector:action withObject:self];
            return;
        }
    }
    [super keyDown:e];
}
@end

// ---- AppController ---------------------------------------------------------

@interface AppController (Private)
- (void)buildMenus;
- (void)buildWindow;
- (void)rebuildVisible;
- (void)updateDisplay;
- (void)updateFolderLabel;
- (void)refreshStatus;
- (void)setPlayStatus:(NSString *)s;
- (void)playTrack:(NSDictionary *)t;
- (void)becameCurrent:(NSDictionary *)t;
- (void)queueNextTrack;
- (void)requeueNext;
- (NSDictionary *)trackAfter:(NSDictionary *)t;
- (NSInteger)rowForPath:(NSString *)path;
- (void)selectPath:(NSString *)path scroll:(BOOL)scroll;
- (BOOL)isShuffle;
- (BOOL)isRepeat;
- (NSString *)serverURL;
- (NSArray *)defaultSort;
@end

@implementation AppController

- (id)init
{
    self = [super init];
    if (self) {
        history = [[NSMutableArray alloc] init];
        shufflePlayed = [[NSMutableSet alloc] init];
        visible = [[NSArray alloc] init];
    }
    return self;
}

// ---- launch / quit ----

- (void)applicationWillFinishLaunching:(NSNotification *)n
{
    [self buildMenus];
}

- (void)applicationDidFinishLaunching:(NSNotification *)n
{
    srandom((unsigned)time(NULL));
    NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
    [ud registerDefaults:[NSDictionary dictionaryWithObjectsAndKeys:
                          [NSNumber numberWithFloat:0.8f], @"volume",
                          [NSNumber numberWithBool:NO], @"shuffle",
                          [NSNumber numberWithBool:NO], @"repeat",
                          nil]];

    sortDescriptors = [[self defaultSort] retain];
    engine = [[AudioEngine alloc] initWithDelegate:self];
    loader = [[TrackLoader alloc] initWithDelegate:self];
    library = [[Library alloc] initWithDelegate:self];
    [self buildWindow];
    [engine setVolume:[volumeSlider floatValue]];

    NSString *root = [ud stringForKey:@"libraryPath"];
    if (root) {
        [library setRootPath:root];
        [self selectPath:[ud stringForKey:@"lastPath"] scroll:YES];
        [library rescan];
    } else {
        [self setPlayStatus:@"Welcome! Choose the music folder on your Time Capsule."];
        [self performSelector:@selector(chooseFolder:) withObject:nil afterDelay:0.5];
    }
    [self updateFolderLabel];
    [self updateDisplay];

    timer = [[NSTimer scheduledTimerWithTimeInterval:0.25 target:self selector:@selector(tick:)
                                            userInfo:nil repeats:YES] retain];
    [window makeKeyAndOrderFront:nil];
    [window makeFirstResponder:table];
    [NSApp activateIgnoringOtherApps:YES];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)app
{
    return YES;
}

- (void)applicationWillTerminate:(NSNotification *)n
{
    [engine stop];
    [[NSUserDefaults standardUserDefaults] synchronize];
}

// ---- UI construction ----

- (NSArray *)defaultSort
{
    return [NSArray arrayWithObjects:
            SortBy(@"artist", @selector(caseInsensitiveCompare:)),
            SortBy(@"album", @selector(caseInsensitiveCompare:)),
            SortBy(@"track", @selector(compare:)),
            SortBy(@"title", @selector(caseInsensitiveCompare:)),
            nil];
}

static NSMenu *AddSubmenu(NSMenu *bar, NSString *title)
{
    NSMenuItem *item = [[[NSMenuItem alloc] initWithTitle:title action:NULL keyEquivalent:@""] autorelease];
    NSMenu *menu = [[[NSMenu alloc] initWithTitle:title] autorelease];
    [item setSubmenu:menu];
    [bar addItem:item];
    return menu;
}

static NSMenuItem *AddItem(NSMenu *menu, NSString *title, SEL action, NSString *key, NSUInteger mods, id target)
{
    NSMenuItem *item = [[[NSMenuItem alloc] initWithTitle:title action:action keyEquivalent:key] autorelease];
    [item setKeyEquivalentModifierMask:mods];
    if (target) [item setTarget:target];
    [menu addItem:item];
    return item;
}

- (void)buildMenus
{
    NSUInteger cmd = NSCommandKeyMask;
    NSMenu *bar = [[[NSMenu alloc] initWithTitle:@"MainMenu"] autorelease];

    NSMenu *app = AddSubmenu(bar, @"CapsulePlayer");
    AddItem(app, @"About CapsulePlayer", @selector(orderFrontStandardAboutPanel:), @"", 0, nil);
    [app addItem:[NSMenuItem separatorItem]];
    AddItem(app, @"Hide CapsulePlayer", @selector(hide:), @"h", cmd, nil);
    AddItem(app, @"Hide Others", @selector(hideOtherApplications:), @"h", cmd | NSAlternateKeyMask, nil);
    AddItem(app, @"Show All", @selector(unhideAllApplications:), @"", 0, nil);
    [app addItem:[NSMenuItem separatorItem]];
    AddItem(app, @"Quit CapsulePlayer", @selector(terminate:), @"q", cmd, nil);

    NSMenu *file = AddSubmenu(bar, @"File");
    AddItem(file, @"Choose Music Folder...", @selector(chooseFolder:), @"o", cmd, self);
    AddItem(file, @"Rescan Library", @selector(rescan:), @"r", cmd | NSShiftKeyMask, self);
    AddItem(file, @"Reconnect to Time Capsule", @selector(reconnect:), @"k", cmd, self);
    [file addItem:[NSMenuItem separatorItem]];
    AddItem(file, @"Close Window", @selector(performClose:), @"w", cmd, nil);

    NSMenu *edit = AddSubmenu(bar, @"Edit");
    AddItem(edit, @"Cut", @selector(cut:), @"x", cmd, nil);
    AddItem(edit, @"Copy", @selector(copy:), @"c", cmd, nil);
    AddItem(edit, @"Paste", @selector(paste:), @"v", cmd, nil);
    AddItem(edit, @"Select All", @selector(selectAll:), @"a", cmd, nil);
    [edit addItem:[NSMenuItem separatorItem]];
    AddItem(edit, @"Find...", @selector(focusSearch:), @"f", cmd, self);

    NSMenu *ctl = AddSubmenu(bar, @"Controls");
    AddItem(ctl, @"Play", @selector(pause:), @"p", cmd, self);
    AddItem(ctl, @"Stop", @selector(stopPlayback:), @".", cmd, self);
    AddItem(ctl, @"Next", @selector(next:), ArrowKey(NSRightArrowFunctionKey), cmd, self);
    AddItem(ctl, @"Previous", @selector(previous:), ArrowKey(NSLeftArrowFunctionKey), cmd, self);
    [ctl addItem:[NSMenuItem separatorItem]];
    AddItem(ctl, @"Forward 5 Seconds", @selector(seekForward:), ArrowKey(NSRightArrowFunctionKey), cmd | NSAlternateKeyMask, self);
    AddItem(ctl, @"Back 5 Seconds", @selector(seekBack:), ArrowKey(NSLeftArrowFunctionKey), cmd | NSAlternateKeyMask, self);
    [ctl addItem:[NSMenuItem separatorItem]];
    AddItem(ctl, @"Volume Up", @selector(volumeUp:), ArrowKey(NSUpArrowFunctionKey), cmd, self);
    AddItem(ctl, @"Volume Down", @selector(volumeDown:), ArrowKey(NSDownArrowFunctionKey), cmd, self);
    [ctl addItem:[NSMenuItem separatorItem]];
    AddItem(ctl, @"Shuffle", @selector(toggleShuffle:), @"s", cmd, self);
    AddItem(ctl, @"Repeat", @selector(toggleRepeat:), @"r", cmd, self);
    [ctl addItem:[NSMenuItem separatorItem]];
    AddItem(ctl, @"Jump to Current Song", @selector(jumpToCurrent:), @"j", cmd, self);

    NSMenu *win = AddSubmenu(bar, @"Window");
    AddItem(win, @"Minimize", @selector(performMiniaturize:), @"m", cmd, nil);
    AddItem(win, @"Zoom", @selector(performZoom:), @"", 0, nil);

    [NSApp setMainMenu:bar];
    [NSApp setWindowsMenu:win];
    if ([NSApp respondsToSelector:@selector(setAppleMenu:)])
        [NSApp performSelector:@selector(setAppleMenu:) withObject:app];
}

static NSButton *MakeButton(NSRect frame, NSString *title, SEL action, id target, NSString *tip)
{
    NSButton *b = [[[NSButton alloc] initWithFrame:frame] autorelease];
    [b setTitle:title];
    [b setBezelStyle:NSTexturedRoundedBezelStyle];
    [b setTarget:target];
    [b setAction:action];
    if (tip) [b setToolTip:tip];
    return b;
}

static NSTableColumn *AddColumn(NSTableView *table, NSString *ident, NSString *title, CGFloat width, SEL sortSel)
{
    NSTableColumn *col = [[[NSTableColumn alloc] initWithIdentifier:ident] autorelease];
    [[col headerCell] setStringValue:title];
    [col setWidth:width];
    [col setEditable:NO];
    [[col dataCell] setLineBreakMode:NSLineBreakByTruncatingTail];
    if (sortSel) [col setSortDescriptorPrototype:SortBy(ident, sortSel)];
    [table addTableColumn:col];
    return col;
}

- (void)buildWindow
{
    const CGFloat W = 860, H = 600;
    window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, W, H)
                                         styleMask:(NSTitledWindowMask | NSClosableWindowMask |
                                                    NSMiniaturizableWindowMask | NSResizableWindowMask)
                                           backing:NSBackingStoreBuffered
                                             defer:NO];
    [window setTitle:@"CapsulePlayer"];
    [window setMinSize:NSMakeSize(620, 380)];
    [window setReleasedWhenClosed:NO];
    [window center];
    NSView *content = [window contentView];

    // --- LCD display ---
    const CGFloat dh = 76, dw = W - 24;
    DisplayView *display = [[[DisplayView alloc] initWithFrame:NSMakeRect(12, H - 12 - dh, dw, dh)] autorelease];
    [display setAutoresizingMask:NSViewWidthSizable | NSViewMinYMargin];
    [content addSubview:display];

    titleField = MakeLabel(NSMakeRect(14, 40, dw - 28 - 180, 24), MonoFont(15), LCDGreen());
    [titleField setAutoresizingMask:NSViewWidthSizable];
    [display addSubview:titleField];

    statusField = MakeLabel(NSMakeRect(14, 12, dw - 28 - 180, 18), [NSFont systemFontOfSize:11], LCDDim());
    [statusField setAutoresizingMask:NSViewWidthSizable];
    [display addSubview:statusField];

    timeField = [[[TimeField alloc] initWithFrame:NSMakeRect(dw - 14 - 170, 16, 170, 44)] autorelease];
    StyleLabel(timeField, MonoFont(32), LCDGreen());
    [timeField setAlignment:NSRightTextAlignment];
    [timeField setAutoresizingMask:NSViewMinXMargin];
    [timeField setTarget:self];
    [timeField setAction:@selector(toggleTimeMode:)];
    [timeField setToolTip:@"Click to show time remaining"];
    [display addSubview:timeField];

    // --- seek bar ---
    CGFloat y = H - 12 - dh - 8 - 22;
    seekSlider = [[[NSSlider alloc] initWithFrame:NSMakeRect(12, y, W - 24, 22)] autorelease];
    [seekSlider setMinValue:0];
    [seekSlider setMaxValue:1];
    [seekSlider setContinuous:NO];
    [seekSlider setTarget:self];
    [seekSlider setAction:@selector(seekSliderMoved:)];
    [seekSlider setAutoresizingMask:NSViewWidthSizable | NSViewMinYMargin];
    [content addSubview:seekSlider];

    // --- transport row ---
    y -= 36;
    struct { const char *title; SEL action; NSString *tip; } transport[] = {
        { "\xE2\x97\x80\xE2\x97\x80", @selector(previous:),     @"Previous (Z)" },
        { "\xE2\x96\xB6",             @selector(play:),         @"Play (X)" },
        { "||",                       @selector(pause:),        @"Pause (C or Space)" },
        { "\xE2\x96\xA0",             @selector(stopPlayback:), @"Stop (V)" },
        { "\xE2\x96\xB6\xE2\x96\xB6", @selector(next:),         @"Next (B)" },
    };
    CGFloat x = 12;
    int i;
    for (i = 0; i < 5; i++) {
        NSButton *b = MakeButton(NSMakeRect(x, y, 46, 28), U(transport[i].title), transport[i].action, self, transport[i].tip);
        [b setAutoresizingMask:NSViewMinYMargin];
        [content addSubview:b];
        x += 50;
    }

    x += 12;
    shuffleButton = [[[NSButton alloc] initWithFrame:NSMakeRect(x, y + 3, 80, 22)] autorelease];
    [shuffleButton setButtonType:NSSwitchButton];
    [shuffleButton setTitle:@"Shuffle"];
    [shuffleButton setTarget:self];
    [shuffleButton setAction:@selector(toggleShuffle:)];
    [shuffleButton setState:[[NSUserDefaults standardUserDefaults] boolForKey:@"shuffle"] ? NSOnState : NSOffState];
    [shuffleButton setAutoresizingMask:NSViewMinYMargin];
    [content addSubview:shuffleButton];
    x += 82;

    repeatButton = [[[NSButton alloc] initWithFrame:NSMakeRect(x, y + 3, 80, 22)] autorelease];
    [repeatButton setButtonType:NSSwitchButton];
    [repeatButton setTitle:@"Repeat"];
    [repeatButton setTarget:self];
    [repeatButton setAction:@selector(toggleRepeat:)];
    [repeatButton setState:[[NSUserDefaults standardUserDefaults] boolForKey:@"repeat"] ? NSOnState : NSOffState];
    [repeatButton setAutoresizingMask:NSViewMinYMargin];
    [content addSubview:repeatButton];
    x += 86;

    NSTextField *volLabel = MakeLabel(NSMakeRect(x, y + 5, 30, 16), [NSFont systemFontOfSize:11], [NSColor controlTextColor]);
    [volLabel setStringValue:@"Vol"];
    [volLabel setAutoresizingMask:NSViewMinYMargin];
    [content addSubview:volLabel];
    volumeSlider = [[[NSSlider alloc] initWithFrame:NSMakeRect(x + 30, y + 3, 110, 22)] autorelease];
    [volumeSlider setMinValue:0];
    [volumeSlider setMaxValue:1];
    [volumeSlider setFloatValue:[[NSUserDefaults standardUserDefaults] floatForKey:@"volume"]];
    [volumeSlider setContinuous:YES];
    [volumeSlider setTarget:self];
    [volumeSlider setAction:@selector(volumeChanged:)];
    [volumeSlider setToolTip:@"Volume (Cmd-Up / Cmd-Down)"];
    [volumeSlider setAutoresizingMask:NSViewMinYMargin];
    [content addSubview:volumeSlider];

    searchField = [[[NSSearchField alloc] initWithFrame:NSMakeRect(W - 12 - 230, y + 2, 230, 24)] autorelease];
    [searchField setTarget:self];
    [searchField setAction:@selector(searchChanged:)];
    [[searchField cell] setPlaceholderString:@"Search artist, title, album"];
    [searchField setAutoresizingMask:NSViewMinXMargin | NSViewMinYMargin];
    [content addSubview:searchField];

    // --- playlist ---
    const CGFloat bottom = 46;
    NSScrollView *scroll = [[[NSScrollView alloc] initWithFrame:NSMakeRect(12, bottom, W - 24, y - 8 - bottom)] autorelease];
    [scroll setHasVerticalScroller:YES];
    [scroll setHasHorizontalScroller:NO];
    [scroll setBorderType:NSBezelBorder];
    [scroll setAutoresizingMask:NSViewWidthSizable | NSViewHeightSizable];

    PlayerTableView *t = [[[PlayerTableView alloc] initWithFrame:[[scroll contentView] bounds]] autorelease];
    [t setController:self];
    AddColumn(t, @"playing", @"", 20, NULL);
    AddColumn(t, @"track", @"#", 34, @selector(compare:));
    AddColumn(t, @"title", @"Title", 290, @selector(caseInsensitiveCompare:));
    AddColumn(t, @"artist", @"Artist", 220, @selector(caseInsensitiveCompare:));
    AddColumn(t, @"album", @"Album", 220, @selector(caseInsensitiveCompare:));
    [t setUsesAlternatingRowBackgroundColors:YES];
    [t setAllowsMultipleSelection:NO];
    [t setAllowsEmptySelection:YES];
    [t setColumnAutoresizingStyle:NSTableViewLastColumnOnlyAutoresizingStyle];
    [t setDataSource:(id)self];
    [t setDelegate:(id)self];
    [t setTarget:self];
    [t setDoubleAction:@selector(tableDoubleClicked:)];
    [t setAutosaveName:@"PlaylistTable"];
    [t setAutosaveTableColumns:YES];
    [scroll setDocumentView:t];
    [content addSubview:scroll];
    table = t;

    // --- bottom bar ---
    const CGFloat bw = 120;
    folderField = MakeLabel(NSMakeRect(12, 16, W - 24 - 3 * bw - 8, 16), [NSFont systemFontOfSize:11], [NSColor disabledControlTextColor]);
    [folderField setAutoresizingMask:NSViewWidthSizable | NSViewMaxYMargin];
    [content addSubview:folderField];

    NSString *titles[3] = { @"Choose Folder...", @"Rescan", @"Reconnect" };
    SEL actions[3] = { @selector(chooseFolder:), @selector(rescan:), @selector(reconnect:) };
    NSString *tips[3] = { @"Pick the music folder on your Time Capsule",
                          @"Look for new or changed songs",
                          @"Mount the Time Capsule again if it dropped off" };
    for (i = 0; i < 3; i++) {
        NSButton *b = [[[NSButton alloc] initWithFrame:NSMakeRect(W - 12 - (3 - i) * bw, 6, bw, 32)] autorelease];
        [b setTitle:titles[i]];
        [b setBezelStyle:NSRoundedBezelStyle];
        [b setTarget:self];
        [b setAction:actions[i]];
        [b setToolTip:tips[i]];
        [b setAutoresizingMask:NSViewMinXMargin | NSViewMaxYMargin];
        [content addSubview:b];
    }

    [window setFrameAutosaveName:@"PlayerWindow"];
}

// ---- status & display ----

- (void)refreshStatus
{
    NSString *s = [playStatus length] ? playStatus : libStatus;
    [statusField setStringValue:s ? s : @""];
}

- (void)setPlayStatus:(NSString *)s
{
    [playStatus release];
    playStatus = [s copy];
    [self refreshStatus];
}

- (NSString *)displayName:(NSDictionary *)t
{
    NSString *artist = [t objectForKey:@"artist"];
    NSString *title = [t objectForKey:@"title"];
    if ([artist length]) return [NSString stringWithFormat:@"%@ - %@", artist, title];
    return title ? title : @"";
}

- (void)updateDisplay
{
    NSDictionary *t = loadingTrack ? loadingTrack : currentTrack;
    BOOL active = [engine isActive];
    double dur = active ? [engine duration] : 0;
    double pos = active ? [engine currentTime] : 0;

    NSString *title = t ? [self displayName:t] : @"CapsulePlayer";
    if (t && !loadingTrack && dur > 0) title = [NSString stringWithFormat:@"%@  (%@)", title, FormatTime(dur)];
    if (![[titleField stringValue] isEqualToString:title]) [titleField setStringValue:title];

    NSString *timeText;
    if (!active) timeText = @"0:00";
    else if (showRemaining && dur > 0) timeText = [@"-" stringByAppendingString:FormatTime(dur - pos)];
    else timeText = FormatTime(pos);
    // Blink while paused, like the old days.
    if (active && [engine isPaused] && ((long)([NSDate timeIntervalSinceReferenceDate] * 2.0)) % 2) timeText = @"";
    [timeField setStringValue:timeText];

    [seekSlider setEnabled:(active && dur > 0)];
    [seekSlider setMaxValue:(dur > 0 ? dur : 1)];
    [seekSlider setDoubleValue:pos];

    NSString *wt = t ? [self displayName:t] : @"CapsulePlayer";
    if (![[window title] isEqualToString:wt]) [window setTitle:wt];
}

- (void)tick:(NSTimer *)t
{
    [self updateDisplay];
}

- (void)updateFolderLabel
{
    NSString *root = [library rootPath];
    if (!root) {
        [folderField setStringValue:@"No music folder chosen"];
        return;
    }
    NSUInteger total = [[library tracks] count], shown = [visible count];
    NSString *count = (shown == total)
        ? [NSString stringWithFormat:@"%lu songs", (unsigned long)total]
        : [NSString stringWithFormat:@"%lu of %lu songs", (unsigned long)shown, (unsigned long)total];
    [folderField setStringValue:[NSString stringWithFormat:@"%@  -  %@", count, root]];
}

// ---- playlist (table) ----

- (NSInteger)rowForPath:(NSString *)path
{
    if (!path) return -1;
    NSUInteger i, n = [visible count];
    for (i = 0; i < n; i++)
        if ([PathOf([visible objectAtIndex:i]) isEqualToString:path]) return (NSInteger)i;
    return -1;
}

- (void)selectPath:(NSString *)path scroll:(BOOL)scroll
{
    NSInteger row = [self rowForPath:path];
    if (row < 0) return;
    [table selectRowIndexes:[NSIndexSet indexSetWithIndex:row] byExtendingSelection:NO];
    if (scroll) [table scrollRowToVisible:row];
}

- (void)rebuildVisible
{
    NSInteger sel = [table selectedRow];
    NSString *selPath = (sel >= 0 && sel < (NSInteger)[visible count]) ? PathOf([visible objectAtIndex:sel]) : nil;

    NSString *query = [[[searchField stringValue] lowercaseString]
                       stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
    NSArray *result = [library tracks];
    if ([query length]) {
        NSArray *words = [query componentsSeparatedByString:@" "];
        NSMutableArray *matches = [NSMutableArray array];
        for (NSDictionary *t in result) {
            NSString *hay = [t objectForKey:@"search"];
            BOOL ok = YES;
            for (NSString *w in words) {
                if ([w length] && [hay rangeOfString:w].location == NSNotFound) { ok = NO; break; }
            }
            if (ok) [matches addObject:t];
        }
        result = matches;
    }
    result = [result sortedArrayUsingDescriptors:sortDescriptors];
    [visible release];
    visible = [result retain];

    [table reloadData];
    [table deselectAll:nil];
    if (selPath) [self selectPath:selPath scroll:NO];
    [self updateFolderLabel];
    [self queueNextTrack]; // the play order may have changed
}

- (NSInteger)numberOfRowsInTableView:(NSTableView *)tv
{
    return (NSInteger)[visible count];
}

- (id)tableView:(NSTableView *)tv objectValueForTableColumn:(NSTableColumn *)col row:(NSInteger)row
{
    if (row < 0 || row >= (NSInteger)[visible count]) return nil;
    NSDictionary *t = [visible objectAtIndex:row];
    NSString *ident = [col identifier];
    if ([ident isEqualToString:@"playing"])
        return SameTrack(t, currentTrack) && [engine isActive] ? U("\xE2\x96\xB6") : @"";
    if ([ident isEqualToString:@"track"]) {
        int n = [[t objectForKey:@"track"] intValue];
        return n > 0 ? [NSString stringWithFormat:@"%d", n] : @"";
    }
    return [t objectForKey:ident];
}

- (void)tableView:(NSTableView *)tv willDisplayCell:(id)cell forTableColumn:(NSTableColumn *)col row:(NSInteger)row
{
    if (row < 0 || row >= (NSInteger)[visible count]) return;
    if (![cell respondsToSelector:@selector(setFont:)]) return;
    BOOL playing = SameTrack([visible objectAtIndex:row], currentTrack);
    CGFloat size = [NSFont systemFontSize];
    [cell setFont:playing ? [NSFont boldSystemFontOfSize:size] : [NSFont systemFontOfSize:size]];
}

- (void)tableView:(NSTableView *)tv sortDescriptorsDidChange:(NSArray *)oldDescriptors
{
    NSMutableArray *s = [NSMutableArray arrayWithArray:[tv sortDescriptors]];
    [s addObjectsFromArray:[self defaultSort]];
    [sortDescriptors release];
    sortDescriptors = [s retain];
    [self rebuildVisible];
}

- (void)tableDoubleClicked:(id)sender
{
    NSInteger row = [table clickedRow];
    if (row >= 0 && row < (NSInteger)[visible count]) [self playTrack:[visible objectAtIndex:row]];
}

// ---- play order ----

- (BOOL)isShuffle { return [shuffleButton state] == NSOnState; }
- (BOOL)isRepeat { return [repeatButton state] == NSOnState; }

- (NSDictionary *)trackAfter:(NSDictionary *)t
{
    NSUInteger n = [visible count];
    if (n == 0) return nil;
    NSString *path = PathOf(t);

    if ([self isShuffle]) {
        // Random, but never the same song twice until everything has played.
        NSMutableArray *candidates = [NSMutableArray array];
        for (NSDictionary *x in visible) {
            NSString *p = PathOf(x);
            if (![shufflePlayed containsObject:p] && ![p isEqualToString:path]) [candidates addObject:x];
        }
        if (![candidates count]) {
            if (![self isRepeat]) return nil;
            [shufflePlayed removeAllObjects];
            if (path) [shufflePlayed addObject:path];
            for (NSDictionary *x in visible)
                if (![PathOf(x) isEqualToString:path]) [candidates addObject:x];
            if (![candidates count]) return t; // a one-song playlist on repeat
        }
        return [candidates objectAtIndex:(NSUInteger)(random() % [candidates count])];
    }

    NSInteger row = [self rowForPath:path];
    if (row < 0) return [visible objectAtIndex:0];
    if ((NSUInteger)row + 1 < n) return [visible objectAtIndex:row + 1];
    return [self isRepeat] ? [visible objectAtIndex:0] : nil;
}

- (NSString *)serverURL
{
    return [[NSUserDefaults standardUserDefaults] stringForKey:@"serverURL"];
}

// Start loading the song that comes after the current one, so that it can
// follow with no gap and no wait on the network.
- (void)queueNextTrack
{
    if (!currentTrack || ![engine isActive]) return;
    // In shuffle mode keep the song already picked if it's still eligible.
    if (pendingNext && [self isShuffle] && [self rowForPath:PathOf(pendingNext)] >= 0 &&
        ![shufflePlayed containsObject:PathOf(pendingNext)]) return;

    NSDictionary *t = [self trackAfter:currentTrack];
    if (t && SameTrack(t, pendingNext)) return; // already on its way

    nextToken++;
    [engine clearNext];
    [pendingNext release];
    pendingNext = [t retain];
    if (t) [loader loadTrack:t purpose:@"next" token:nextToken serverURL:[self serverURL]];
}

- (void)requeueNext
{
    [pendingNext release];
    pendingNext = nil;
    [self queueNextTrack];
}

// ---- playback ----

- (void)playTrack:(NSDictionary *)t
{
    if (!t) return;
    // Already loaded as the next song? Then switch instantly.
    if (SameTrack(t, pendingNext) && [engine isActive] && [engine skipToNext]) return;

    playToken++;
    nextToken++;
    [engine stop];
    [pendingNext release];
    pendingNext = nil;
    [loadingTrack release];
    loadingTrack = [t retain];
    [self setPlayStatus:@"Loading from the Time Capsule..."];
    [loader loadTrack:t purpose:@"play" token:playToken serverURL:[self serverURL]];
    [self updateDisplay];
    [table reloadData];
}

- (void)becameCurrent:(NSDictionary *)t
{
    BOOL follow = NO;
    NSInteger sel = [table selectedRow];
    if (sel < 0) follow = YES;
    else if (sel < (NSInteger)[visible count] && SameTrack([visible objectAtIndex:sel], currentTrack)) follow = YES;

    [t retain];
    [currentTrack release];
    currentTrack = t;
    [history addObject:t];
    if ([history count] > 1000) [history removeObjectAtIndex:0];
    [shufflePlayed addObject:PathOf(t)];
    [[NSUserDefaults standardUserDefaults] setObject:PathOf(t) forKey:@"lastPath"];

    [pendingNext release];
    pendingNext = nil;
    [self queueNextTrack];

    [table reloadData];
    if (follow) [self selectPath:PathOf(t) scroll:YES];
    [self updateDisplay];
}

- (void)trackLoaded:(NSDictionary *)r
{
    NSString *purpose = [r objectForKey:@"purpose"];
    NSInteger token = [[r objectForKey:@"token"] integerValue];
    NSDictionary *t = [r objectForKey:@"track"];
    Decoder *dec = [r objectForKey:@"decoder"];
    NSString *err = [r objectForKey:@"error"];

    if ([purpose isEqualToString:@"play"]) {
        if (token != playToken) return; // the user has since picked something else
        [loadingTrack release];
        loadingTrack = nil;
        if (dec && [engine playDecoder:dec]) {
            failures = 0;
            [self setPlayStatus:nil];
            [self becameCurrent:t];
            return;
        }
        if (dec) err = @"The sound output couldn't start";
        failures++;
        [shufflePlayed addObject:PathOf(t)];
        if (failures < 5) {
            [self setPlayStatus:[NSString stringWithFormat:@"Skipped \"%@\": %@", [t objectForKey:@"title"], err]];
            NSDictionary *after = [self trackAfter:t];
            if (after && !SameTrack(after, t)) { [self playTrack:after]; return; }
        } else {
            [self setPlayStatus:[NSString stringWithFormat:@"Stopped: %@", err]];
        }
        [self updateDisplay];
        [table reloadData];
        return;
    }

    // purpose == "next"
    if (token != nextToken) return;
    if (dec) {
        [engine setNextDecoder:dec];
        return;
    }
    // Couldn't fetch the next song: line up the one after it instead.
    failures++;
    [shufflePlayed addObject:PathOf(t)];
    [pendingNext release];
    pendingNext = nil;
    if (failures < 5) {
        [self setPlayStatus:[NSString stringWithFormat:@"Will skip \"%@\": %@", [t objectForKey:@"title"], err]];
        NSDictionary *after = [self trackAfter:t];
        if (after && !SameTrack(after, currentTrack)) {
            pendingNext = [after retain];
            nextToken++;
            [loader loadTrack:after purpose:@"next" token:nextToken serverURL:[self serverURL]];
        }
    } else {
        [self setPlayStatus:[NSString stringWithFormat:@"Can't load more songs: %@", err]];
    }
}

- (void)engineDidAdvance:(Decoder *)d
{
    if (![engine isActive]) return;
    failures = 0;
    if ([playStatus hasPrefix:@"Buffering"] || [playStatus hasPrefix:@"Will skip"]) [self setPlayStatus:nil];
    [self becameCurrent:[d track]];
}

- (void)engineRanOut:(AudioEngine *)e
{
    if (![engine isStarved]) return; // stale: something new is already playing
    if (pendingNext) {
        [self setPlayStatus:@"Buffering next song..."];
    } else {
        [engine stop];
        [self setPlayStatus:@"End of playlist"];
        [table reloadData];
        [self updateDisplay];
    }
}

// ---- actions ----

- (IBAction)playSelected:(id)sender
{
    NSInteger row = [table selectedRow];
    if (row >= 0 && row < (NSInteger)[visible count]) [self playTrack:[visible objectAtIndex:row]];
}

- (IBAction)play:(id)sender
{
    if ([engine isActive]) {
        if ([engine isPaused]) [engine resume];
        else [engine seekToSeconds:0]; // Winamp: Play while playing restarts the song
        [self updateDisplay];
        return;
    }
    if (loadingTrack) return;
    NSInteger row = [table selectedRow];
    NSDictionary *t = nil;
    if (row >= 0 && row < (NSInteger)[visible count]) t = [visible objectAtIndex:row];
    else if (currentTrack) t = currentTrack;
    else if ([visible count]) t = [self isShuffle] ? [self trackAfter:nil] : [visible objectAtIndex:0];
    [self playTrack:t];
}

- (IBAction)pause:(id)sender
{
    if (![engine isActive]) { [self play:sender]; return; }
    if ([engine isPaused]) [engine resume];
    else [engine pause];
    [self updateDisplay];
}

- (IBAction)stopPlayback:(id)sender
{
    playToken++;
    nextToken++;
    [engine stop];
    [pendingNext release];
    pendingNext = nil;
    [loadingTrack release];
    loadingTrack = nil;
    [self setPlayStatus:nil];
    [table reloadData];
    [self updateDisplay];
}

- (IBAction)next:(id)sender
{
    if ([engine isActive] && pendingNext && [engine skipToNext]) return; // instant: already in memory
    NSDictionary *base = loadingTrack ? loadingTrack : currentTrack;
    NSDictionary *t = pendingNext ? pendingNext : [self trackAfter:base];
    if (!t && [visible count]) t = [visible objectAtIndex:0]; // pressing Next at the end wraps
    [self playTrack:t];
}

- (IBAction)previous:(id)sender
{
    if ([engine isActive] && [engine currentTime] > 3.0) {
        [engine seekToSeconds:0];
        return;
    }
    NSDictionary *t = nil;
    if ([self isShuffle]) {
        if ([history count] >= 2) {
            [history removeLastObject];                 // the current song
            t = [[[history lastObject] retain] autorelease];
            [history removeLastObject];                 // re-added when it plays
        }
    } else {
        NSInteger row = [self rowForPath:PathOf(currentTrack)];
        if (row > 0) t = [visible objectAtIndex:row - 1];
        else if (row == 0 && [self isRepeat]) t = [visible lastObject];
        else if (row < 0 && [visible count]) t = [visible objectAtIndex:0];
    }
    if (t) [self playTrack:t];
    else if ([engine isActive]) [engine seekToSeconds:0];
}

- (IBAction)seekForward:(id)sender
{
    if ([engine isActive]) [engine seekToSeconds:[engine currentTime] + 5.0];
}

- (IBAction)seekBack:(id)sender
{
    if ([engine isActive]) [engine seekToSeconds:[engine currentTime] - 5.0];
}

- (void)seekSliderMoved:(id)sender
{
    if ([engine isActive]) [engine seekToSeconds:[seekSlider doubleValue]];
}

- (void)volumeChanged:(id)sender
{
    [engine setVolume:[volumeSlider floatValue]];
    [[NSUserDefaults standardUserDefaults] setFloat:[volumeSlider floatValue] forKey:@"volume"];
}

- (void)volumeUp:(id)sender
{
    [volumeSlider setFloatValue:MIN(1.0f, [volumeSlider floatValue] + 0.05f)];
    [self volumeChanged:sender];
}

- (void)volumeDown:(id)sender
{
    [volumeSlider setFloatValue:MAX(0.0f, [volumeSlider floatValue] - 0.05f)];
    [self volumeChanged:sender];
}

- (void)toggleShuffle:(id)sender
{
    if (sender != shuffleButton) [shuffleButton setState:[self isShuffle] ? NSOffState : NSOnState];
    [[NSUserDefaults standardUserDefaults] setBool:[self isShuffle] forKey:@"shuffle"];
    [shufflePlayed removeAllObjects];
    if (currentTrack) [shufflePlayed addObject:PathOf(currentTrack)];
    [self requeueNext];
}

- (void)toggleRepeat:(id)sender
{
    if (sender != repeatButton) [repeatButton setState:[self isRepeat] ? NSOffState : NSOnState];
    [[NSUserDefaults standardUserDefaults] setBool:[self isRepeat] forKey:@"repeat"];
    [self requeueNext];
}

- (void)toggleTimeMode:(id)sender
{
    showRemaining = !showRemaining;
    [timeField setToolTip:showRemaining ? @"Click to show time elapsed" : @"Click to show time remaining"];
    [self updateDisplay];
}

- (void)searchChanged:(id)sender
{
    [self rebuildVisible];
}

- (void)focusSearch:(id)sender
{
    [window makeFirstResponder:searchField];
}

- (void)jumpToCurrent:(id)sender
{
    if (!currentTrack) return;
    if ([self rowForPath:PathOf(currentTrack)] < 0 && [[searchField stringValue] length]) {
        [searchField setStringValue:@""];
        [self rebuildVisible];
    }
    [self selectPath:PathOf(currentTrack) scroll:YES];
    [window makeFirstResponder:table];
}

- (BOOL)validateMenuItem:(NSMenuItem *)item
{
    SEL a = [item action];
    if (a == @selector(toggleShuffle:)) [item setState:[shuffleButton state]];
    else if (a == @selector(toggleRepeat:)) [item setState:[repeatButton state]];
    else if (a == @selector(pause:))
        [item setTitle:([engine isActive] && ![engine isPaused]) ? @"Pause" : @"Play"];
    return YES;
}

// ---- library ----

- (void)chooseFolder:(id)sender
{
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    [panel setCanChooseDirectories:YES];
    [panel setCanChooseFiles:NO];
    [panel setAllowsMultipleSelection:NO];
    [panel setTitle:@"Choose your music folder"];
    [panel setPrompt:@"Choose"];
    [panel setMessage:@"Pick the folder with your songs on the Time Capsule. (Connect to it in the Finder first: "
                      @"it's under Shared in the sidebar.) Choose the music folder itself, not the whole disk."];
    if ([panel runModal] != 1 /* OK */) return;
    NSArray *urls = [panel URLs];
    if (![urls count]) return;
    NSString *path = [[urls objectAtIndex:0] path];
    [[NSUserDefaults standardUserDefaults] setObject:path forKey:@"libraryPath"];
    [library setRootPath:path];
    [library rescan];
    [self updateFolderLabel];
}

- (void)rescan:(id)sender
{
    if (![library rootPath]) [self chooseFolder:sender];
    else [library rescan];
}

- (void)reconnect:(id)sender
{
    NSString *root = [library rootPath];
    if (!root) { [self chooseFolder:sender]; return; }
    NSString *vol = [VolumeHelper volumeRootForPath:root];
    NSString *url = [self serverURL];
    if (!vol) { [library rescan]; return; } // a local folder

    if (!url && ![[NSFileManager defaultManager] fileExistsAtPath:vol]) {
        NSAlert *alert = [[[NSAlert alloc] init] autorelease];
        [alert setMessageText:@"Connect to your Time Capsule in the Finder"];
        [alert setInformativeText:@"In the Finder choose Go > Connect to Server (or click your Time Capsule under "
                                  @"Shared in the sidebar), then click Rescan. After that, CapsulePlayer will "
                                  @"remember how to reconnect on its own."];
        [alert runModal];
        return;
    }
    [self setPlayStatus:@"Connecting to the Time Capsule..."];
    NSMutableDictionary *job = [NSMutableDictionary dictionaryWithObject:vol forKey:@"volume"];
    if (url) [job setObject:url forKey:@"url"];
    [NSThread detachNewThreadSelector:@selector(reconnectThread:) toTarget:self withObject:job];
}

- (void)reconnectThread:(NSDictionary *)job
{
    NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];
    BOOL ok = [VolumeHelper mountURL:[job objectForKey:@"url"] thenCheckPath:[job objectForKey:@"volume"]];
    [self performSelectorOnMainThread:@selector(reconnectDone:) withObject:[NSNumber numberWithBool:ok] waitUntilDone:NO];
    [pool release];
}

- (void)reconnectDone:(NSNumber *)ok
{
    if ([ok boolValue]) {
        [self setPlayStatus:nil];
        [library rescan];
    } else {
        [self setPlayStatus:@"Couldn't reach the Time Capsule. Is it on, and is this Mac on the same network?"];
    }
}

- (void)libraryChanged:(Library *)lib
{
    [self rebuildVisible];
}

- (void)library:(Library *)lib status:(NSString *)message
{
    [libStatus release];
    libStatus = [message copy];
    [self refreshStatus];
}

- (void)library:(Library *)lib foundServerURL:(NSString *)url
{
    [[NSUserDefaults standardUserDefaults] setObject:url forKey:@"serverURL"];
}

@end
