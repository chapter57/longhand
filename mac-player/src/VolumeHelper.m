#import "VolumeHelper.h"

static NSLock *gMountLock = nil;

@implementation VolumeHelper

+ (void)initialize
{
    if (self == [VolumeHelper class] && !gMountLock) gMountLock = [[NSLock alloc] init];
}

+ (NSString *)volumeRootForPath:(NSString *)path
{
    NSArray *parts = [[path stringByStandardizingPath] pathComponents];
    // ("/", "Volumes", "Data", ...)
    if ([parts count] >= 3 && [[parts objectAtIndex:1] isEqualToString:@"Volumes"])
        return [NSString pathWithComponents:[parts subarrayWithRange:NSMakeRange(0, 3)]];
    return nil;
}

+ (NSString *)runTool:(NSString *)tool args:(NSArray *)args status:(int *)status
{
    NSTask *task = [[[NSTask alloc] init] autorelease];
    NSPipe *pipe = [NSPipe pipe];
    [task setLaunchPath:tool];
    [task setArguments:args];
    [task setStandardOutput:pipe];
    [task setStandardError:[NSFileHandle fileHandleWithNullDevice]];
    NSString *result = nil;
    @try {
        [task launch];
        NSData *data = [[pipe fileHandleForReading] readDataToEndOfFile];
        [task waitUntilExit];
        if (status) *status = [task terminationStatus];
        result = [[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] autorelease];
    } @catch (NSException *e) {
        if (status) *status = -1;
    }
    return result;
}

+ (NSString *)remountURLForPath:(NSString *)path
{
    NSString *root = [self volumeRootForPath:path];
    if (!root) return nil;
    NSString *output = [self runTool:@"/sbin/mount" args:[NSArray array] status:NULL];
    NSString *marker = [NSString stringWithFormat:@" on %@ (", root];
    NSEnumerator *lines = [[output componentsSeparatedByString:@"\n"] objectEnumerator];
    NSString *line;
    while ((line = [lines nextObject])) {
        NSRange r = [line rangeOfString:marker];
        if (r.location == NSNotFound) continue;
        NSString *source = [line substringToIndex:r.location];       // //user@host/share
        NSString *rest = [line substringFromIndex:NSMaxRange(r)];     // afpfs, nodev, ...
        NSString *fstype = [[rest componentsSeparatedByString:@","] objectAtIndex:0];
        if (![source hasPrefix:@"//"]) return nil;
        if ([fstype hasPrefix:@"afp"]) return [@"afp:" stringByAppendingString:source];
        if ([fstype hasPrefix:@"smb"]) return [@"smb:" stringByAppendingString:source];
        return nil;
    }
    return nil;
}

+ (BOOL)mountURL:(NSString *)url thenCheckPath:(NSString *)path
{
    NSFileManager *fm = [[[NSFileManager alloc] init] autorelease];
    [gMountLock lock];
    BOOL ok = [fm fileExistsAtPath:path];
    if (!ok && [url length]) {
        NSString *quoted = [[url stringByReplacingOccurrencesOfString:@"\\" withString:@"\\\\"]
                               stringByReplacingOccurrencesOfString:@"\"" withString:@"\\\""];
        NSString *script = [NSString stringWithFormat:@"mount volume \"%@\"", quoted];
        [self runTool:@"/usr/bin/osascript" args:[NSArray arrayWithObjects:@"-e", script, nil] status:NULL];
        ok = [fm fileExistsAtPath:path];
    }
    [gMountLock unlock];
    return ok;
}

@end
