#import <Cocoa/Cocoa.h>

@class Library, AudioEngine, TrackLoader;

@interface AppController : NSObject {
    NSWindow *window;
    NSTextField *titleField;
    NSTextField *timeField;
    NSTextField *statusField;
    NSTextField *folderField;
    NSSlider *seekSlider;
    NSSlider *volumeSlider;
    NSButton *shuffleButton;
    NSButton *repeatButton;
    NSSearchField *searchField;
    NSTableView *table;
    NSTimer *timer;

    Library *library;
    AudioEngine *engine;
    TrackLoader *loader;

    NSArray *visible;            // the playlist as shown: filtered + sorted
    NSArray *sortDescriptors;
    NSDictionary *currentTrack;  // what the engine is playing
    NSDictionary *loadingTrack;  // asked to play, still coming over the network
    NSDictionary *pendingNext;   // being prefetched / queued for gapless play
    NSMutableArray *history;     // for Previous in shuffle mode
    NSMutableSet *shufflePlayed;
    NSInteger playToken;
    NSInteger nextToken;
    NSInteger failures;
    BOOL showRemaining;
    NSString *playStatus;        // "Loading...", errors; shown over libStatus
    NSString *libStatus;         // scan progress
}

// Actions (buttons, menus and the Winamp keys z x c v b).
- (IBAction)previous:(id)sender;
- (IBAction)play:(id)sender;
- (IBAction)pause:(id)sender;
- (IBAction)stopPlayback:(id)sender;
- (IBAction)next:(id)sender;
- (IBAction)playSelected:(id)sender;
- (IBAction)seekForward:(id)sender;
- (IBAction)seekBack:(id)sender;
@end
