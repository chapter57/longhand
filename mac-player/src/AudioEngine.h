#import <Foundation/Foundation.h>
#import <AudioToolbox/AudioToolbox.h>
#include <pthread.h>

#define kEngineBufferCount  4
#define kEngineBufferFrames 8192   // 4 x 8192 frames ~= 0.75 s of audio queued
#define kEngineSampleRate   44100.0

// A whole song held in memory and opened for decoding. Because the file
// was copied off the network in one go, playback never waits on Wi-Fi.
@interface Decoder : NSObject {
@public
    const unsigned char *bytes;
    SInt64 length;
@private
    NSData *data;
    NSDictionary *track;
    AudioFileID audioFile;
    ExtAudioFileRef extFile;
    double fileSampleRate;
    SInt64 fileLengthFrames;
}
- (id)initWithData:(NSData *)d track:(NSDictionary *)t error:(NSString **)err;
- (NSDictionary *)track;
- (double)duration;
- (OSStatus)read:(UInt32 *)frames into:(AudioBufferList *)abl;
- (BOOL)seekToSeconds:(double)seconds;
@end

// Plays Decoders through a single AudioQueue. Because tracks are decoded
// into one continuous stream, the queued "next" track starts with no gap.
@interface AudioEngine : NSObject {
    AudioQueueRef queue;
    AudioQueueBufferRef buffers[kEngineBufferCount];
    pthread_mutex_t lock;
    Decoder *current;
    Decoder *next;
    id delegate;
    BOOL running;
    BOOL paused;
    BOOL ranOutPosted;
    float volume;
    SInt64 framesEnqueued;
    SInt64 trackStartFrame;
    double trackStartSeconds;
    double lastTime;
}
- (id)initWithDelegate:(id)d;

- (BOOL)playDecoder:(Decoder *)d;      // start this track now
- (void)setNextDecoder:(Decoder *)d;   // follow the current one, gaplessly
- (void)clearNext;
- (BOOL)skipToNext;                    // jump to the queued next, if loaded
- (BOOL)hasNext;

- (void)pause;
- (void)resume;
- (void)stop;
- (void)seekToSeconds:(double)seconds;
- (void)setVolume:(float)v;

- (BOOL)isActive;      // a track is loaded (playing or paused)
- (BOOL)isPaused;
- (BOOL)isStarved;     // running, but the last song ended with nothing queued
- (double)currentTime;
- (double)duration;
@end

// Delegate methods, always called on the main thread.
@interface NSObject (AudioEngineDelegate)
- (void)engineDidAdvance:(Decoder *)nowPlaying;  // a queued track took over
- (void)engineRanOut:(AudioEngine *)engine;      // current ended, nothing queued
@end
