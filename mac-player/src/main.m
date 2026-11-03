#import <Cocoa/Cocoa.h>
#import "AppController.h"

int main(int argc, char *argv[])
{
    NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];
    NSApplication *app = [NSApplication sharedApplication];
    AppController *controller = [[AppController alloc] init];
    [app setDelegate:(id)controller];
    [app run];
    [controller release];
    [pool release];
    return 0;
}
