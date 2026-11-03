#import <Foundation/Foundation.h>

// Reads ID3v2 (2.2 / 2.3 / 2.4) and ID3v1 tags from an MP3 file.
// Only the tag bytes are read, never the audio, so this stays quick even
// over a slow network share.
@interface TagReader : NSObject
// Returns a dictionary that may contain @"title", @"artist", @"album"
// (NSStrings) and @"track" (NSNumber). Never returns nil.
+ (NSDictionary *)tagsForFile:(NSString *)path;
@end
