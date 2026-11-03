#import "TrackLoader.h"
#import "AudioEngine.h"
#import "VolumeHelper.h"

@implementation TrackLoader

- (id)initWithDelegate:(id)d
{
    self = [super init];
    if (self) delegate = d;
    return self;
}

- (void)loadTrack:(NSDictionary *)track
          purpose:(NSString *)purpose
            token:(NSInteger)token
        serverURL:(NSString *)serverURL
{
    NSMutableDictionary *job = [NSMutableDictionary dictionary];
    [job setObject:track forKey:@"track"];
    [job setObject:purpose forKey:@"purpose"];
    [job setObject:[NSNumber numberWithInteger:token] forKey:@"token"];
    if (serverURL) [job setObject:serverURL forKey:@"serverURL"];
    [NSThread detachNewThreadSelector:@selector(loadThread:) toTarget:self withObject:job];
}

- (void)loadThread:(NSMutableDictionary *)job
{
    NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];
    NSFileManager *fm = [[[NSFileManager alloc] init] autorelease];
    NSDictionary *track = [job objectForKey:@"track"];
    NSString *path = [track objectForKey:@"path"];
    NSString *volumeRoot = [VolumeHelper volumeRootForPath:path];
    NSString *serverURL = [job objectForKey:@"serverURL"];

    // Wait a little longer each time: a sleeping Time Capsule disk can
    // take several seconds to spin up.
    static const double delays[] = {0, 1, 2, 4, 8};
    const int attempts = volumeRoot ? 5 : 1;
    NSData *data = nil;
    NSString *error = @"Could not read the file";
    int i;
    for (i = 0; i < attempts && !data; i++) {
        if (delays[i] > 0) [NSThread sleepForTimeInterval:delays[i]];

        if (volumeRoot && ![fm fileExistsAtPath:volumeRoot]) {
            // The share dropped off (sleep, Wi-Fi blip): mount it again.
            if (![VolumeHelper mountURL:serverURL thenCheckPath:volumeRoot]) {
                error = @"The Time Capsule isn't connected";
                continue;
            }
        }
        if (![fm fileExistsAtPath:path]) {
            if (!volumeRoot || [fm fileExistsAtPath:volumeRoot]) {
                error = @"File not found (moved or deleted?)";
                break;
            }
            continue;
        }

        NSError *e = nil;
        data = [NSData dataWithContentsOfFile:path options:0 error:&e];
        if (!data && e) error = [e localizedDescription];
    }

    NSMutableDictionary *result = [NSMutableDictionary dictionary];
    [result setObject:track forKey:@"track"];
    [result setObject:[job objectForKey:@"purpose"] forKey:@"purpose"];
    [result setObject:[job objectForKey:@"token"] forKey:@"token"];

    if (data) {
        NSString *decodeError = nil;
        Decoder *dec = [[Decoder alloc] initWithData:data track:track error:&decodeError];
        if (dec) {
            [result setObject:dec forKey:@"decoder"];
            [dec release];
        } else {
            error = decodeError ? decodeError : @"Could not decode the file";
        }
    }
    if (![result objectForKey:@"decoder"]) [result setObject:error forKey:@"error"];

    [delegate performSelectorOnMainThread:@selector(trackLoaded:) withObject:result waitUntilDone:NO];
    [pool release];
}

@end
