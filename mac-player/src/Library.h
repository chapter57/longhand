#import <Foundation/Foundation.h>

// The song index for one folder (usually a folder on the Time Capsule).
// Each track is an NSDictionary with @"path", @"title", @"artist",
// @"album", @"track" (NSNumber), @"size", @"mtime" and @"search".
//
// The index is cached in ~/Library/Application Support/CapsulePlayer, so
// it shows up instantly at launch; rescans only read tags from new or
// changed files. While scanning, songs appear as they're found (named by
// their folders), then get their real titles as the tags are read.
@interface Library : NSObject {
    id delegate;
    NSString *rootPath;
    NSArray *tracks;
    BOOL scanning;
    BOOL rescanWhenDone;
    NSInteger generation;
    NSTimeInterval lastSave;
}
- (id)initWithDelegate:(id)d;
- (NSString *)rootPath;
- (void)setRootPath:(NSString *)path;  // loads the cache for that folder
- (NSArray *)tracks;
- (BOOL)isScanning;
- (void)rescan;                        // background; safe to call any time
@end

@interface NSObject (LibraryDelegate)
- (void)libraryChanged:(Library *)library;
- (void)library:(Library *)library status:(NSString *)message;
- (void)library:(Library *)library foundServerURL:(NSString *)url;
@end
