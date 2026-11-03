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

static NSDictionary *MakeTrack(NSString *full, NSString *rel, NSNumber *size, NSNumber *mtime)
{
    NSString *ext = [[full pathExtension] lowercaseString];
    NSDictionary *tags = [ext isEqualToString:@"mp3"] ? [TagReader tagsForFile:full] : nil;

    // Fall back on the folder layout: Artist/Album/01 Song.mp3
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
            nil];
}

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

        NSMutableArray *found = [NSMutableArray array];
        NSDirectoryEnumerator *en = [fm enumeratorAtPath:root];
        NSString *rel;
        NSUInteger seen = 0, fresh = 0;
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
            if (prev && [[prev objectForKey:@"size"] isEqual:size] && [[prev objectForKey:@"mtime"] isEqual:mtime]) {
                [found addObject:prev];
            } else {
                [found addObject:MakeTrack(full, rel, size, mtime)];
                fresh++;
            }
            seen++;
            if (seen % 200 == 0) {
                NSString *msg = [NSString stringWithFormat:@"Scanning library... %lu songs (%lu new)",
                                 (unsigned long)seen, (unsigned long)fresh];
                [self performSelectorOnMainThread:@selector(postStatus:) withObject:msg waitUntilDone:NO];
                [inner release];
                inner = [[NSAutoreleasePool alloc] init];
            }
        }
        [inner release];

        // If the share vanished mid-scan the listing is incomplete: keep
        // the old index rather than throwing songs away.
        if (![fm fileExistsAtPath:root]) {
            [result setObject:@"Lost the connection while scanning; kept the previous library" forKey:@"error"];
        } else {
            [result setObject:found forKey:@"tracks"];
        }
    }

    [self performSelectorOnMainThread:@selector(scanFinished:) withObject:result waitUntilDone:NO];
    [pool release];
}

- (void)scanFinished:(NSDictionary *)result
{
    scanning = NO;
    NSString *url = [result objectForKey:@"serverURL"];
    if (url) [delegate library:self foundServerURL:url];

    if ([[result objectForKey:@"generation"] integerValue] == generation) {
        NSArray *found = [result objectForKey:@"tracks"];
        if (found) {
            [tracks release];
            tracks = [found retain];
            NSDictionary *cache = [NSDictionary dictionaryWithObjectsAndKeys:rootPath, @"root", tracks, @"tracks", nil];
            [cache writeToFile:[Library cachePath] atomically:YES];
            [delegate libraryChanged:self];
            [delegate library:self status:[NSString stringWithFormat:@"Library up to date: %lu songs",
                                           (unsigned long)[tracks count]]];
        } else {
            [delegate library:self status:[result objectForKey:@"error"]];
        }
    } else {
        rescanWhenDone = YES; // the folder changed while we were scanning
    }
    if (rescanWhenDone) [self rescan];
}

@end
