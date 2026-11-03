#import <Foundation/Foundation.h>

// Copies a song off the network share into memory on a background thread,
// retrying (and re-mounting the share) if the network hiccups, then opens
// it for decoding.
@interface TrackLoader : NSObject {
    id delegate;
}
- (id)initWithDelegate:(id)d;

// `purpose` is echoed back so the caller can tell loads apart ("play" or
// "next"); `token` lets the caller ignore results it no longer wants.
- (void)loadTrack:(NSDictionary *)track
          purpose:(NSString *)purpose
            token:(NSInteger)token
        serverURL:(NSString *)serverURL;
@end

@interface NSObject (TrackLoaderDelegate)
// Called on the main thread. Keys: @"track", @"purpose", @"token"
// (NSNumber), and either @"decoder" (a Decoder) or @"error" (NSString).
- (void)trackLoaded:(NSDictionary *)result;
@end
