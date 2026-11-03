#import "Library.h"
#import "TagReader.h"
#import "VolumeHelper.h"

static BOOL IsAudioFile(NSString *name)
{
    static NSSet *exts = nil;
    if (!exts) exts = [[NSSet alloc] initWithObjects:@"mp3", @"m4a", @"aac", @"wav", @"aif", @"aiff", nil];
    return [exts containsObject:[[name pathExtension] lowercaseString]];
}

// Folders we must never walk into. On a Time Capsule the Time Machine
// backups sit right next to your music and hold millions of files.
static BOOL ShouldSkipFolder(NSString *name)
{
    if ([name hasPrefix:@"."]) return YES;
    if ([name isEqualToString:@"Backups.backupdb"]) return YES;
    NSString *ext = [[name pathExtension] lowercaseString];
    return [ext isEqualToString:@"sparsebundle"] || [ext isEqualToString:@"sparseimage"] ||
           [ext isEqualToString:@"app"] || [ext isEqualToString:@"photoslibrary"] ||
           [ext isEqualToString:@"aplibrary"] || [ext isEqualToString:@"backup"];
}

static NSString *OrEmpty(NSString *s) { return s ? s : @""; }

// Builds a track entry. `tags` may be nil (not read yet): then the names
// come from the folder layout, Artist/Album/01 Song.mp3, and the entry is
// marked untagged so the tags get read later.
static NSDictionary *MakeTrack(NSString *full, NSString *rel, NSNumber *size, NSNumber *mtime,
                               NSDictionary *tags, BOOL tagged)
{
    NSArray *parts = [rel pathComponents];
    NSUInteger n = [parts count];
    NSString *stem = [[parts lastObject] stringByDeletingPathExtension];
    NSString *title = [tags objectForKey:@"title"];
    NSString *artist = [tags objectForKey:@"artist"];
    NSString *album = [tags objectForKey:@"album"];
    NSNumber *trackNo = [tags objectForKey:@"track"];
    if (!artist) artist = [tags objectForKey:@"albumArtist"];
    if (!title) title = stem;
    if (!album && n >= 2) album = [parts objectAtIndex:n - 2];
    if (!artist && n >= 3) artist = [parts objectAtIndex:n - 3];
    if (!trackNo) trackNo = [NSNumber numberWithInt:([stem intValue] > 0 && [stem intValue] < 1000) ? [stem intValue] : 0];

    NSString *search = [[NSString stringWithFormat:@"%@ %@ %@", OrEmpty(artist), OrEmpty(title), OrEmpty(album)] lowercaseString];
    return [NSDictionary dictionaryWithObjectsAndKeys:
            full, @"path",
            OrEmpty(title), @"title",
            OrEmpty(artist), @"artist",
            OrEmpty(album), @"album",
            trackNo, @"track",
            size, @"size",
            mtime, @"mtime",
            search, @"search",
            [NSNumber numberWithBool:tagged], @"tagged",
            nil];
}

// Entries cached before the "tagged" key existed were all fully read.
static BOOL IsTagged(NSDictionary *t)
{
    NSNumber *n = [t objectForKey:@"tagged"];
    return n == nil || [n boolValue];
}

@interface Library (Private)
- (void)postPartial:(NSArray *)found generation:(NSNumber *)gen status:(NSString *)status;
- (void)saveCache;
@end

@implementation Library

+ (NSString *)cachePath
{
    NSArray *dirs = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES);
    NSString *base = [dirs count] ? [dirs objectAtIndex:0] : [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Application Support"];
    NSString *dir = [base stringByAppendingPathComponent:@"CapsulePlayer"];
    [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:NULL];
    return [dir stringByAppendingPathComponent:@"Library.plist"];
}

- (id)initWithDelegate:(id)d
{
    self = [super init];
    if (self) {
        delegate = d;
        tracks = [[NSArray alloc] init];
    }
    return self;
}

- (void)dealloc
{
    [rootPath release];
    [tracks release];
    [super dealloc];
}

- (NSString *)rootPath { return rootPath; }
- (NSArray *)tracks { return tracks; }
- (BOOL)isScanning { return scanning; }

- (void)setRootPath:(NSString *)path
{
    if ([path isEqualToString:rootPath]) return;
    [rootPath release];
    rootPath = [path copy];
    generation++;

    NSDictionary *cache = [NSDictionary dictionaryWithContentsOfFile:[Library cachePath]];
    NSArray *cached = nil;
    if (path && [[cache objectForKey:@"root"] isEqual:path]) cached = [cache objectForKey:@"tracks"];
    [tracks release];
    tracks = [(cached ? cached : [NSArray array]) retain];
    [delegate libraryChanged:self];
}

- (void)rescan
{
    if (!rootPath) return;
    if (scanning) { rescanWhenDone = YES; return; }
    scanning = YES;
    rescanWhenDone = NO;
    NSDictionary *job = [NSDictionary dictionaryWithObjectsAndKeys:
                         rootPath, @"root",
                         tracks, @"old",
                         [NSNumber numberWithInteger:generation], @"generation",
                         nil];
    [delegate library:self status:@"Scanning library..."];
    [NSThread detachNewThreadSelector:@selector(scanThread:) toTarget:self withObject:job];
}

- (void)postStatus:(NSString *)message
{
    [delegate library:self status:message];
}

- (void)scanThread:(NSDictionary *)job
{
    NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];
    NSFileManager *fm = [[[NSFileManager alloc] init] autorelease];
    NSString *root = [job objectForKey:@"root"];
    NSNumber *gen = [job objectForKey:@"generation"];
    NSMutableDictionary *result = [NSMutableDictionary dictionaryWithDictionary:job];

    // Old entries by path, so unchanged files don't need re-reading.
    NSMutableDictionary *old = [NSMutableDictionary dictionary];
    NSEnumerator *oe = [[job objectForKey:@"old"] objectEnumerator];
    NSDictionary *t;
    while ((t = [oe nextObject])) [old setObject:t forKey:[t objectForKey:@"path"]];

    BOOL isDir = NO;
    if (![fm fileExistsAtPath:root isDirectory:&isDir] || !isDir) {
        [result setObject:@"Can't reach the music folder. Is the Time Capsule connected? (File > Reconnect)" forKey:@"error"];
    } else {
        NSString *url = [VolumeHelper remountURLForPath:root];
        if (url) [result setObject:url forKey:@"serverURL"];

        // Pass 1: list every song quickly (no file is opened), so the
        // whole library shows up within seconds, named by its folders.
        NSMutableArray *found = [NSMutableArray array];
        NSMutableArray *needTags = [NSMutableArray array]; // {index, rel}
        NSDirectoryEnumerator *en = [fm enumeratorAtPath:root];
        NSString *rel;
        NSTimeInterval lastPost = [NSDate timeIntervalSinceReferenceDate];
        NSAutoreleasePool *inner = [[NSAutoreleasePool alloc] init];
        while ((rel = [en nextObject])) {
            NSString *name = [rel lastPathComponent];
            NSDictionary *attrs = [en fileAttributes];
            NSString *type = [attrs fileType];
            if ([type isEqualToString:NSFileTypeDirectory]) {
                if (ShouldSkipFolder(name)) [en skipDescendents];
                continue;
            }
            if (![type isEqualToString:NSFileTypeRegular]) continue;
            if ([name hasPrefix:@"."] || !IsAudioFile(name)) continue; // "._x.mp3" = Mac metadata

            NSString *full = [root stringByAppendingPathComponent:rel];
            NSNumber *size = [NSNumber numberWithUnsignedLongLong:[attrs fileSize]];
            NSNumber *mtime = [NSNumber numberWithDouble:[[attrs fileModificationDate] timeIntervalSinceReferenceDate]];
            NSDictionary *prev = [old objectForKey:full];
            if (prev && IsTagged(prev) && [[prev objectForKey:@"size"] isEqual:size] &&
                [[prev objectForKey:@"mtime"] isEqual:mtime]) {
                [found addObject:prev];
            } else {
                BOOL mp3 = [[[name pathExtension] lowercaseString] isEqualToString:@"mp3"];
                [found addObject:MakeTrack(full, rel, size, mtime, nil, !mp3)];
                if (mp3) [needTags addObject:[NSArray arrayWithObjects:
                                              [NSNumber numberWithUnsignedInteger:[found count] - 1], rel, nil]];
            }

            NSTimeInterval now = [NSDate timeIntervalSinceReferenceDate];
            if (now - lastPost > 1.5) {
                lastPost = now;
                [self postPartial:found generation:gen
                           status:[NSString stringWithFormat:@"Finding songs... %lu so far",
                                   (unsigned long)[found count]]];
                [inner release];
                inner = [[NSAutoreleasePool alloc] init];
            }
        }
        [inner release];

        if (![fm fileExistsAtPath:root]) {
            // The share vanished mid-listing, so the list is incomplete:
            // put the previous library back rather than losing songs.
            [result setObject:@"Lost the connection while scanning; kept the previous library" forKey:@"error"];
            [result setObject:[NSNumber numberWithBool:YES] forKey:@"restore"];
        } else {
            NSUInteger total = [needTags count], done = 0;
            if (total) {
                [self postPartial:found generation:gen
                           status:[NSString stringWithFormat:@"Found %lu songs. Reading song details: 0 of %lu",
                                   (unsigned long)[found count], (unsigned long)total]];
            }

            // Pass 2: read the real titles / artists from the new songs.
            // (Indexed loop: the autorelease pool is drained as we go, so
            // nothing created inside it may outlive one stretch of songs.)
            inner = [[NSAutoreleasePool alloc] init];
            NSUInteger k;
            for (k = 0; k < total; k++) {
                NSArray *job2 = [needTags objectAtIndex:k];
                NSUInteger idx = [[job2 objectAtIndex:0] unsignedIntegerValue];
                NSDictionary *entry = [found objectAtIndex:idx];
                NSDictionary *tags = [TagReader tagsForFile:[entry objectForKey:@"path"]];
                if (!tags && ![fm fileExistsAtPath:root]) {
                    // Connection gone. Keep what we have; the rest stay
                    // marked untagged and get read on the next scan.
                    [result setObject:@"Lost the connection; the remaining song details will be read next scan"
                               forKey:@"error"];
                    break;
                }
                if (tags) {
                    [found replaceObjectAtIndex:idx withObject:MakeTrack([entry objectForKey:@"path"],
                                                                         [job2 objectAtIndex:1],
                                                                         [entry objectForKey:@"size"],
                                                                         [entry objectForKey:@"mtime"], tags, YES)];
                }
                done++;
                NSTimeInterval now = [NSDate timeIntervalSinceReferenceDate];
                if (now - lastPost > 3.0) {
                    lastPost = now;
                    [self postPartial:found generation:gen
                               status:[NSString stringWithFormat:@"Reading song details: %lu of %lu",
                                       (unsigned long)done, (unsigned long)total]];
                    [inner release];
                    inner = [[NSAutoreleasePool alloc] init];
                }
            }
            [inner release];
            [result setObject:found forKey:@"tracks"];
        }
    }

    [self performSelectorOnMainThread:@selector(scanFinished:) withObject:result waitUntilDone:NO];
    [pool release];
}

// Called from the scan thread: hands a snapshot of the list so far to the
// main thread.
- (void)postPartial:(NSArray *)found generation:(NSNumber *)gen status:(NSString *)status
{
    NSDictionary *info = [NSDictionary dictionaryWithObjectsAndKeys:
                          [NSArray arrayWithArray:found], @"tracks", gen, @"generation", status, @"status", nil];
    [self performSelectorOnMainThread:@selector(partialResults:) withObject:info waitUntilDone:NO];
}

- (void)saveCache
{
    NSDictionary *cache = [NSDictionary dictionaryWithObjectsAndKeys:rootPath, @"root", tracks, @"tracks", nil];
    [cache writeToFile:[Library cachePath] atomically:YES];
    lastSave = [NSDate timeIntervalSinceReferenceDate];
}

- (void)partialResults:(NSDictionary *)info
{
    if ([[info objectForKey:@"generation"] integerValue] != generation) return;
    [tracks release];
    tracks = [[info objectForKey:@"tracks"] retain];
    [delegate libraryChanged:self];
    [delegate library:self status:[info objectForKey:@"status"]];
    // Save progress now and then, so quitting mid-scan loses little.
    if ([NSDate timeIntervalSinceReferenceDate] - lastSave > 15.0) [self saveCache];
}

- (void)scanFinished:(NSDictionary *)result
{
    scanning = NO;
    NSString *url = [result objectForKey:@"serverURL"];
    if (url) [delegate library:self foundServerURL:url];

    if ([[result objectForKey:@"generation"] integerValue] == generation) {
        NSArray *found = [result objectForKey:@"tracks"];
        NSString *error = [result objectForKey:@"error"];
        if ([result objectForKey:@"restore"]) found = [result objectForKey:@"old"];
        if (found) {
            [tracks release];
            tracks = [found retain];
            [self saveCache];
            [delegate libraryChanged:self];
        }
        [delegate library:self status:error ? error :
            [NSString stringWithFormat:@"Library up to date: %lu songs", (unsigned long)[tracks count]]];
    } else {
        rescanWhenDone = YES; // the folder changed while we were scanning
    }
    if (rescanWhenDone) [self rescan];
}

@end
