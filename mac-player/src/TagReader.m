#import "TagReader.h"
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Text frames are tiny; anything bigger than this isn't a name we want.
#define MAX_TEXT_FRAME 4096
// Cap for the rare whole-tag-unsynchronised case, which must be read whole.
#define MAX_UNSYNC_TAG (128 * 1024)

static uint32_t Syncsafe(const unsigned char *b)
{
    return ((uint32_t)(b[0] & 0x7f) << 21) | ((uint32_t)(b[1] & 0x7f) << 14) |
           ((uint32_t)(b[2] & 0x7f) << 7) | (uint32_t)(b[3] & 0x7f);
}

static uint32_t BigEndian32(const unsigned char *b)
{
    return ((uint32_t)b[0] << 24) | ((uint32_t)b[1] << 16) | ((uint32_t)b[2] << 8) | (uint32_t)b[3];
}

// Undo ID3 "unsynchronisation" (every 0xFF 0x00 becomes 0xFF). In place.
static size_t Unsync(unsigned char *buf, size_t len)
{
    size_t r = 0, w = 0;
    while (r < len) {
        unsigned char c = buf[r++];
        buf[w++] = c;
        if (c == 0xFF && r < len && buf[r] == 0x00) r++;
    }
    return w;
}

static NSString *Clean(NSString *s)
{
    if (!s) return nil;
    NSMutableCharacterSet *junk = [[[NSCharacterSet whitespaceAndNewlineCharacterSet] mutableCopy] autorelease];
    [junk addCharactersInRange:NSMakeRange(0, 1)]; // NUL
    s = [s stringByTrimmingCharactersInSet:junk];
    return [s length] ? s : nil;
}

// "Latin-1" tags in the wild are often really UTF-8 or Windows-1252.
static NSString *EightBitString(const unsigned char *b, size_t len)
{
    NSString *s = [[[NSString alloc] initWithBytes:b length:len encoding:NSUTF8StringEncoding] autorelease];
    if (!s) s = [[[NSString alloc] initWithBytes:b length:len encoding:NSWindowsCP1252StringEncoding] autorelease];
    if (!s) s = [[[NSString alloc] initWithBytes:b length:len encoding:NSISOLatin1StringEncoding] autorelease];
    return s;
}

static NSString *DecodeTextFrame(const unsigned char *b, size_t len)
{
    if (len < 2) return nil;
    unsigned char enc = b[0];
    b++; len--;
    NSString *s = nil;
    if (enc == 1 || enc == 2) {
        NSStringEncoding e = NSUTF16BigEndianStringEncoding;
        if (enc == 1 && len >= 2) {
            if (b[0] == 0xFF && b[1] == 0xFE) { e = NSUTF16LittleEndianStringEncoding; b += 2; len -= 2; }
            else if (b[0] == 0xFE && b[1] == 0xFF) { b += 2; len -= 2; }
        }
        size_t n = 0;
        while (n + 1 < len && (b[n] || b[n + 1])) n += 2;
        s = [[[NSString alloc] initWithBytes:b length:n encoding:e] autorelease];
    } else {
        size_t n = 0;
        while (n < len && b[n]) n++;
        s = EightBitString(b, n);
    }
    return Clean(s);
}

static NSString *KeyForFrame(const char *fid)
{
    if (!strcmp(fid, "TIT2") || !strcmp(fid, "TT2")) return @"title";
    if (!strcmp(fid, "TPE1") || !strcmp(fid, "TP1")) return @"artist";
    if (!strcmp(fid, "TPE2") || !strcmp(fid, "TP2")) return @"albumArtist";
    if (!strcmp(fid, "TALB") || !strcmp(fid, "TAL")) return @"album";
    if (!strcmp(fid, "TRCK") || !strcmp(fid, "TRK")) return @"track";
    return nil;
}

// Everything we want (title, artist, album, track) is in hand.
static BOOL HaveAll(NSDictionary *out)
{
    return [out objectForKey:@"title"] && [out objectForKey:@"artist"] &&
           [out objectForKey:@"album"] && [out objectForKey:@"track"];
}

// Reads a frame header. Returns NO at padding / garbage.
static BOOL ParseFrameHeader(const unsigned char *h, int ver, char fid[5], uint32_t *fsize, unsigned char *fflags)
{
    if (h[0] == 0) return NO; // reached padding
    memset(fid, 0, 5);
    *fflags = 0;
    if (ver == 2) {
        memcpy(fid, h, 3);
        *fsize = ((uint32_t)h[3] << 16) | ((uint32_t)h[4] << 8) | (uint32_t)h[5];
    } else {
        memcpy(fid, h, 4);
        // iTunes once wrote v2.4 tags with plain (non-syncsafe) sizes.
        if (ver == 4 && !((h[4] | h[5] | h[6] | h[7]) & 0x80)) *fsize = Syncsafe(h + 4);
        else *fsize = BigEndian32(h + 4);
        *fflags = h[9];
    }
    return YES;
}

// Decodes one wanted text frame's body into `out`.
static void HandleFrame(NSString *key, unsigned char *data, size_t dlen, int ver, unsigned char fflags,
                        NSMutableDictionary *out)
{
    NSMutableData *copy = nil;
    if (ver == 4) {
        if (fflags & 0x0C) return;                   // compressed / encrypted
        if (fflags & 0x01) {                         // data length indicator
            if (dlen < 4) return;
            data += 4;
            dlen -= 4;
        }
        if (fflags & 0x02) {                         // per-frame unsync
            copy = [NSMutableData dataWithBytes:data length:dlen];
            data = (unsigned char *)[copy mutableBytes];
            dlen = Unsync(data, dlen);
        }
    } else if (ver == 3 && (fflags & 0xC0)) {
        return;                                      // compressed / encrypted
    }
    NSString *s = DecodeTextFrame(data, dlen);
    if (!s) return;
    if ([key isEqualToString:@"track"]) {
        int n = [s intValue]; // "3/12" -> 3
        if (n > 0) [out setObject:[NSNumber numberWithInt:n] forKey:key];
    } else {
        [out setObject:s forKey:key];
    }
}

// For the rare tag that is unsynchronised as a whole (ID3v2.3): read it
// into memory (capped) and parse it there.
static void ParseID3v2Buffer(unsigned char *tag, size_t len, int ver, unsigned char flags,
                             NSMutableDictionary *out)
{
    size_t pos = 0;
    len = Unsync(tag, len);
    if (flags & 0x40) { // extended header: skip it
        if (len < 4) return;
        pos = (ver == 4) ? Syncsafe(tag) : BigEndian32(tag) + 4;
    }
    size_t hdr = (ver == 2) ? 6 : 10;
    while (pos + hdr <= len) {
        char fid[5];
        uint32_t fsize;
        unsigned char fflags;
        if (!ParseFrameHeader(tag + pos, ver, fid, &fsize, &fflags)) break;
        pos += hdr;
        if (fsize == 0) continue;
        if (fsize > len - pos) break;
        NSString *key = KeyForFrame(fid);
        if (key && ![out objectForKey:key]) HandleFrame(key, tag + pos, fsize, ver, fflags, out);
        pos += fsize;
        if (HaveAll(out)) break;
    }
}

// The normal case: walk the tag frame by frame straight from the file,
// reading only the small text frames we want and seeking past everything
// else (album art can be hundreds of KB per song; over Wi-Fi, for thousands
// of songs, reading it would take ages).
static void ParseID3v2Stream(FILE *f, uint32_t tagSize, int ver, unsigned char flags, NSMutableDictionary *out)
{
    uint32_t pos = 0; // offset within the tag body (after the 10-byte header)
    if (flags & 0x40) { // extended header: skip it
        unsigned char e[4];
        if (fread(e, 1, 4, f) != 4) return;
        pos = (ver == 4) ? Syncsafe(e) : BigEndian32(e) + 4;
    }
    const uint32_t hdr = (ver == 2) ? 6 : 10;
    unsigned char frame[MAX_TEXT_FRAME];
    while (pos + hdr <= tagSize) {
        unsigned char h[10];
        if (fseeko(f, 10 + (off_t)pos, SEEK_SET) != 0 || fread(h, 1, hdr, f) != hdr) break;
        char fid[5];
        uint32_t fsize;
        unsigned char fflags;
        if (!ParseFrameHeader(h, ver, fid, &fsize, &fflags)) break;
        pos += hdr;
        if (fsize == 0) continue;
        if (fsize > tagSize - pos) break;
        NSString *key = KeyForFrame(fid);
        if (key && ![out objectForKey:key] && fsize <= MAX_TEXT_FRAME) {
            if (fread(frame, 1, fsize, f) != fsize) break;
            HandleFrame(key, frame, fsize, ver, fflags, out);
        }
        pos += fsize;
        if (HaveAll(out)) break;
    }
}

static void SetV1Field(NSMutableDictionary *out, NSString *key, const unsigned char *b, size_t len)
{
    if ([out objectForKey:key]) return;
    size_t n = 0;
    while (n < len && b[n]) n++;
    NSString *s = Clean(EightBitString(b, n));
    if (s) [out setObject:s forKey:key];
}

@implementation TagReader

+ (NSDictionary *)tagsForFile:(NSString *)path
{
    NSMutableDictionary *out = [NSMutableDictionary dictionary];
    FILE *f = fopen([path fileSystemRepresentation], "rb");
    if (!f) return nil;
    // Small reads: we hop between little frames and skip the rest, so big
    // read-ahead (which on a network share means real Wi-Fi traffic) is waste.
    setvbuf(f, NULL, _IOFBF, 8192);

    unsigned char h[10];
    if (fread(h, 1, 10, f) == 10 && memcmp(h, "ID3", 3) == 0 && h[3] >= 2 && h[3] <= 4) {
        uint32_t size = Syncsafe(h + 6);
        if (h[3] < 4 && (h[5] & 0x80)) {
            if (size > MAX_UNSYNC_TAG) size = MAX_UNSYNC_TAG;
            unsigned char *buf = (unsigned char *)malloc(size + 1);
            if (buf) {
                size_t got = fread(buf, 1, size, f);
                ParseID3v2Buffer(buf, got, h[3], h[5], out);
                free(buf);
            }
        } else {
            ParseID3v2Stream(f, size, h[3], h[5], out);
        }
    }

    // Fall back to the old 128-byte ID3v1 tag at the end of the file.
    if (![out objectForKey:@"title"] || ![out objectForKey:@"artist"]) {
        unsigned char t[128];
        if (fseeko(f, -128, SEEK_END) == 0 && fread(t, 1, 128, f) == 128 && memcmp(t, "TAG", 3) == 0) {
            SetV1Field(out, @"title", t + 3, 30);
            SetV1Field(out, @"artist", t + 33, 30);
            SetV1Field(out, @"album", t + 63, 30);
            if (![out objectForKey:@"track"] && t[125] == 0 && t[126] != 0)
                [out setObject:[NSNumber numberWithInt:t[126]] forKey:@"track"];
        }
    }
    fclose(f);
    return out;
}

@end
