#import <Foundation/Foundation.h>

// Helpers for network shares such as an AirPort Time Capsule.
@interface VolumeHelper : NSObject

// "/Volumes/Data/Music/x.mp3" -> "/Volumes/Data". nil for local paths.
+ (NSString *)volumeRootForPath:(NSString *)path;

// Asks the system how the volume holding `path` was mounted and returns a
// URL that can mount it again, e.g. "afp://Time-Capsule.local/Data".
// Runs /sbin/mount, so call it off the main thread. nil if not a share.
+ (NSString *)remountURLForPath:(NSString *)path;

// Mounts a share (blocking; may show the system's password prompt).
// Only one mount runs at a time. Returns YES if `path` exists afterwards.
+ (BOOL)mountURL:(NSString *)url thenCheckPath:(NSString *)path;

@end
