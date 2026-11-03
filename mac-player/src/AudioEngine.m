#import "AudioEngine.h"
#include <string.h>

#define kBytesPerFrame 4  // 16-bit stereo

static AudioStreamBasicDescription EngineFormat(void)
{
    AudioStreamBasicDescription f;
    memset(&f, 0, sizeof(f));
    f.mSampleRate = kEngineSampleRate;
    f.mFormatID = kAudioFormatLinearPCM;
    f.mFormatFlags = kLinearPCMFormatFlagIsSignedInteger | kAudioFormatFlagsNativeEndian |
                     kLinearPCMFormatFlagIsPacked;
    f.mBitsPerChannel = 16;
    f.mChannelsPerFrame = 2;
    f.mBytesPerFrame = kBytesPerFrame;
    f.mFramesPerPacket = 1;
    f.mBytesPerPacket = kBytesPerFrame;
    return f;
}

static AudioFileTypeID TypeHintForPath(NSString *path)
{
    NSString *ext = [[path pathExtension] lowercaseString];
    if ([ext isEqualToString:@"mp3"]) return kAudioFileMP3Type;
    if ([ext isEqualToString:@"m4a"] || [ext isEqualToString:@"m4b"] || [ext isEqualToString:@"mp4"])
        return kAudioFileM4AType;
    if ([ext isEqualToString:@"aac"]) return kAudioFileAAC_ADTSType;
    if ([ext isEqualToString:@"wav"]) return kAudioFileWAVEType;
    if ([ext isEqualToString:@"aif"] || [ext isEqualToString:@"aiff"]) return kAudioFileAIFFType;
    if ([ext isEqualToString:@"aifc"]) return kAudioFileAIFCType;
    return 0;
}

// ---- Decoder ---------------------------------------------------------------

static OSStatus DecoderReadProc(void *client, SInt64 pos, UInt32 count, void *buf, UInt32 *actual)
{
    Decoder *d = (Decoder *)client;
    if (pos < 0 || pos >= d->length) { *actual = 0; return noErr; }
    UInt32 n = count;
    if (pos + (SInt64)n > d->length) n = (UInt32)(d->length - pos);
    memcpy(buf, d->bytes + pos, n);
    *actual = n;
    return noErr;
}

static SInt64 DecoderSizeProc(void *client)
{
    return ((Decoder *)client)->length;
}

@implementation Decoder

- (id)initWithData:(NSData *)d track:(NSDictionary *)t error:(NSString **)err
{
    self = [super init];
    if (!self) return nil;
    data = [d retain];
    track = [t retain];
    bytes = (const unsigned char *)[data bytes];
    length = (SInt64)[data length];

    AudioFileTypeID hint = TypeHintForPath([t objectForKey:@"path"]);
    OSStatus st = AudioFileOpenWithCallbacks(self, DecoderReadProc, NULL, DecoderSizeProc, NULL, hint, &audioFile);
    if (st != noErr && hint != kAudioFileMP3Type)
        st = AudioFileOpenWithCallbacks(self, DecoderReadProc, NULL, DecoderSizeProc, NULL, kAudioFileMP3Type, &audioFile);
    if (st != noErr) {
        audioFile = NULL;
        if (err) *err = @"Not a playable audio file (damaged or unsupported format)";
        [self release];
        return nil;
    }

    st = ExtAudioFileWrapAudioFileID(audioFile, false, &extFile);
    if (st != noErr) {
        extFile = NULL;
        if (err) *err = @"Could not start the audio decoder";
        [self release];
        return nil;
    }

    AudioStreamBasicDescription fileFormat;
    UInt32 size = sizeof(fileFormat);
    memset(&fileFormat, 0, sizeof(fileFormat));
    ExtAudioFileGetProperty(extFile, kExtAudioFileProperty_FileDataFormat, &size, &fileFormat);
    fileSampleRate = fileFormat.mSampleRate > 0 ? fileFormat.mSampleRate : kEngineSampleRate;

    AudioStreamBasicDescription client = EngineFormat();
    st = ExtAudioFileSetProperty(extFile, kExtAudioFileProperty_ClientDataFormat, sizeof(client), &client);
    if (st != noErr) {
        if (err) *err = @"This file's audio format can't be converted for playback";
        [self release];
        return nil;
    }

    fileLengthFrames = 0;
    size = sizeof(fileLengthFrames);
    ExtAudioFileGetProperty(extFile, kExtAudioFileProperty_FileLengthFrames, &size, &fileLengthFrames);
    return self;
}

- (void)dealloc
{
    if (extFile) ExtAudioFileDispose(extFile);
    if (audioFile) AudioFileClose(audioFile);
    [data release];
    [track release];
    [super dealloc];
}

- (NSDictionary *)track { return track; }

- (double)duration
{
    return fileLengthFrames > 0 ? (double)fileLengthFrames / fileSampleRate : 0.0;
}

- (OSStatus)read:(UInt32 *)frames into:(AudioBufferList *)abl
{
    return ExtAudioFileRead(extFile, frames, abl);
}

- (BOOL)seekToSeconds:(double)seconds
{
    SInt64 frame = (SInt64)(seconds * fileSampleRate);
    if (frame < 0) frame = 0;
    if (fileLengthFrames > 0 && frame >= fileLengthFrames) frame = fileLengthFrames - 1;
    return ExtAudioFileSeek(extFile, frame) == noErr;
}

@end

// ---- AudioEngine -----------------------------------------------------------

@interface AudioEngine (Private)
- (void)fillBuffer:(AudioQueueBufferRef)buf fromQueue:(AudioQueueRef)q;
- (void)disposeQueue;
- (BOOL)startQueueAtSeconds:(double)seconds;
- (void)discard:(id)obj;
@end

static void EngineOutputCallback(void *userData, AudioQueueRef q, AudioQueueBufferRef buf)
{
    [(AudioEngine *)userData fillBuffer:buf fromQueue:q];
}

@implementation AudioEngine

- (id)initWithDelegate:(id)d
{
    self = [super init];
    if (self) {
        pthread_mutex_init(&lock, NULL);
        delegate = d;
        volume = 1.0f;
    }
    return self;
}

- (void)dealloc
{
    [self stop];
    pthread_mutex_destroy(&lock);
    [super dealloc];
}

// Runs on the AudioQueue's own thread (and on the main thread while priming).
- (void)fillBuffer:(AudioQueueBufferRef)buf fromQueue:(AudioQueueRef)q
{
    NSAutoreleasePool *pool = [[NSAutoreleasePool alloc] init];
    pthread_mutex_lock(&lock);
    if (!running || q != queue) {
        pthread_mutex_unlock(&lock);
        [pool release];
        return;
    }

    UInt32 capacity = buf->mAudioDataBytesCapacity / kBytesPerFrame;
    UInt32 filled = 0;
    char *dst = (char *)buf->mAudioData;

    while (filled < capacity && current) {
        AudioBufferList abl;
        abl.mNumberBuffers = 1;
        abl.mBuffers[0].mNumberChannels = 2;
        abl.mBuffers[0].mDataByteSize = (capacity - filled) * kBytesPerFrame;
        abl.mBuffers[0].mData = dst + filled * kBytesPerFrame;
        UInt32 n = capacity - filled;
        OSStatus st = [current read:&n into:&abl];
        if (st == noErr && n > 0) {
            filled += n;
            continue;
        }
        // The current track is over (or unreadable from here on).
        Decoder *done = current;
        current = next;
        next = nil;
        if (current) {
            // Gapless hand-over: the next song starts in this same buffer.
            trackStartFrame = framesEnqueued + filled;
            trackStartSeconds = 0;
            [delegate performSelectorOnMainThread:@selector(engineDidAdvance:) withObject:current waitUntilDone:NO];
        } else if (!ranOutPosted) {
            ranOutPosted = YES;
            [delegate performSelectorOnMainThread:@selector(engineRanOut:) withObject:self waitUntilDone:NO];
        }
        // Free the finished song on the main thread, not the audio thread.
        [self performSelectorOnMainThread:@selector(discard:) withObject:done waitUntilDone:NO];
        [done release];
    }

    // If nothing is ready (e.g. the next song is still coming over the
    // network) play silence and keep the queue alive, so it can resume
    // the moment the song arrives.
    if (filled < capacity) memset(dst + filled * kBytesPerFrame, 0, (capacity - filled) * kBytesPerFrame);
    buf->mAudioDataByteSize = capacity * kBytesPerFrame;
    framesEnqueued += capacity;
    AudioQueueEnqueueBuffer(q, buf, 0, NULL);

    pthread_mutex_unlock(&lock);
    [pool release];
}

- (void)discard:(id)obj
{
    // Nothing to do: performSelectorOnMainThread kept `obj` alive until now,
    // so its last release (and the decoder teardown) happens here.
}

- (void)disposeQueue
{
    if (!queue) return;
    pthread_mutex_lock(&lock);
    running = NO;
    pthread_mutex_unlock(&lock);
    AudioQueueStop(queue, true);
    AudioQueueDispose(queue, true);
    queue = NULL;
}

- (BOOL)startQueueAtSeconds:(double)seconds
{
    AudioStreamBasicDescription fmt = EngineFormat();
    AudioQueueRef q = NULL;
    OSStatus st = AudioQueueNewOutput(&fmt, EngineOutputCallback, self, NULL, NULL, 0, &q);
    if (st != noErr || !q) return NO;
    int i;
    for (i = 0; i < kEngineBufferCount; i++) {
        st = AudioQueueAllocateBuffer(q, kEngineBufferFrames * kBytesPerFrame, &buffers[i]);
        if (st != noErr) {
            AudioQueueDispose(q, true);
            return NO;
        }
    }
    AudioQueueSetParameter(q, kAudioQueueParam_Volume, volume);

    pthread_mutex_lock(&lock);
    queue = q;
    running = YES;
    ranOutPosted = NO;
    framesEnqueued = 0;
    trackStartFrame = 0;
    trackStartSeconds = seconds;
    lastTime = seconds;
    pthread_mutex_unlock(&lock);

    for (i = 0; i < kEngineBufferCount; i++) [self fillBuffer:buffers[i] fromQueue:q];
    if (!paused) {
        st = AudioQueueStart(q, NULL);
        if (st != noErr) {
            [self disposeQueue];
            return NO;
        }
    }
    return YES;
}

- (BOOL)playDecoder:(Decoder *)d
{
    [self disposeQueue];
    pthread_mutex_lock(&lock);
    [current autorelease];
    current = [d retain];
    [next autorelease];
    next = nil;
    pthread_mutex_unlock(&lock);
    paused = NO;
    return [self startQueueAtSeconds:0];
}

- (void)setNextDecoder:(Decoder *)d
{
    BOOL advancedNow = NO;
    pthread_mutex_lock(&lock);
    if (running) {
        if (!current) {
            // We already ran out and are playing silence: start right away.
            current = [d retain];
            trackStartFrame = framesEnqueued;
            trackStartSeconds = 0;
            ranOutPosted = NO;
            advancedNow = YES;
        } else {
            [next autorelease];
            next = [d retain];
        }
    }
    pthread_mutex_unlock(&lock);
    if (advancedNow)
        [delegate performSelectorOnMainThread:@selector(engineDidAdvance:) withObject:d waitUntilDone:NO];
}

- (void)clearNext
{
    pthread_mutex_lock(&lock);
    [next autorelease];
    next = nil;
    pthread_mutex_unlock(&lock);
}

- (BOOL)hasNext
{
    pthread_mutex_lock(&lock);
    BOOL r = (next != nil);
    pthread_mutex_unlock(&lock);
    return r;
}

- (BOOL)skipToNext
{
    if (!queue || ![self hasNext]) return NO;
    [self disposeQueue];
    pthread_mutex_lock(&lock);
    Decoder *d = next;
    next = nil;
    [current autorelease];
    current = d; // takes over next's retain
    pthread_mutex_unlock(&lock);
    if (![self startQueueAtSeconds:0]) return NO;
    [delegate performSelectorOnMainThread:@selector(engineDidAdvance:) withObject:d waitUntilDone:NO];
    return YES;
}

- (void)pause
{
    if (queue && !paused) {
        AudioQueuePause(queue);
        paused = YES;
    }
}

- (void)resume
{
    if (queue && paused) {
        paused = NO;
        if (AudioQueueStart(queue, NULL) != noErr) {
            // The output device may have changed; rebuild the queue.
            double t = [self currentTime];
            [self seekToSeconds:t];
        }
    }
}

- (void)stop
{
    [self disposeQueue];
    pthread_mutex_lock(&lock);
    [current autorelease];
    current = nil;
    [next autorelease];
    next = nil;
    lastTime = 0;
    pthread_mutex_unlock(&lock);
    paused = NO;
}

- (void)seekToSeconds:(double)seconds
{
    if (!queue) return;
    [self disposeQueue];
    pthread_mutex_lock(&lock);
    if (seconds < 0) seconds = 0;
    if (current) {
        double dur = [current duration];
        if (dur > 0 && seconds > dur - 0.25) seconds = dur > 0.25 ? dur - 0.25 : 0;
        [current seekToSeconds:seconds];
    } else {
        seconds = 0;
    }
    pthread_mutex_unlock(&lock);
    [self startQueueAtSeconds:seconds];
}

- (void)setVolume:(float)v
{
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    volume = v;
    if (queue) AudioQueueSetParameter(queue, kAudioQueueParam_Volume, volume);
}

- (BOOL)isActive { return queue != NULL; }
- (BOOL)isPaused { return paused; }

- (BOOL)isStarved
{
    pthread_mutex_lock(&lock);
    BOOL r = (queue != NULL && current == nil);
    pthread_mutex_unlock(&lock);
    return r;
}

- (double)currentTime
{
    if (!queue) return 0;
    AudioTimeStamp ts;
    memset(&ts, 0, sizeof(ts));
    OSStatus st = AudioQueueGetCurrentTime(queue, NULL, &ts, NULL);
    pthread_mutex_lock(&lock);
    if (st == noErr && (ts.mFlags & kAudioTimeStampSampleTimeValid)) {
        double t = trackStartSeconds + (ts.mSampleTime - (double)trackStartFrame) / kEngineSampleRate;
        if (t < 0) t = 0;
        double dur = current ? [current duration] : 0;
        if (dur > 0 && t > dur) t = dur;
        lastTime = t;
    }
    double result = lastTime;
    pthread_mutex_unlock(&lock);
    return result;
}

- (double)duration
{
    pthread_mutex_lock(&lock);
    double d = current ? [current duration] : 0;
    pthread_mutex_unlock(&lock);
    return d;
}

@end
