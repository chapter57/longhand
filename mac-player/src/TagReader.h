#import <Foundation/Foundation.h>

// Reads ID3v2 (2.2 / 2.3 / 2.4) and ID3v1 tags from an MP3 file.
// Only the small text frames are read (album art and audio are skipped),
// so this stays quick even over a slow network share.
@interface TagReader : NSObject
// Returns a dictionary that may contain @"title", @"artist", @"album"
// (NSStrings) and @"track" (NSNumber). Returns nil if the file couldn't be
// opened (e.g. the network share dropped), so callers can retry later.
+ (NSDictionary *)tagsForFile:(NSString *)path;
@end
